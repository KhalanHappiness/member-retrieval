from flask import Flask, request, jsonify, session
from flask_cors import CORS
from models import db, Member, User
import pandas as pd
import os
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
from functools import wraps

app = Flask(__name__)
CORS(app, origins="http://localhost:5173", supports_credentials=True)
app.config['SECRET_KEY'] = 'your-secret-key-change-this-in-production'  # Change this!

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///sacco_members.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
ALLOWED_EXTENSIONS = {'xlsx', 'xls'}

# Create upload folder if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize database
db.init_app(app)

with app.app_context():
    db.create_all()
    
    # Create default admin user if none exists
    if User.query.count() == 0:
        default_admin = User(
            username='admin',
            email='admin@sacco.com',
            role='admin'
        )
        default_admin.set_password('admin123')  # Change this!
        db.session.add(default_admin)
        db.session.commit()
        print("Default admin user created: username='admin', password='admin123'")

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Authentication decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

# ============= AUTHENTICATION ROUTES =============

@app.route('/auth/login', methods=['POST'])
def login():
    """Login endpoint"""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    user = User.query.filter_by(username=username).first()
    
    if user and user.check_password(password) and user.is_active:
        session['user_id'] = user.id
        session['username'] = user.username
        session['role'] = user.role
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'user': user.to_dict()
        })
    
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/auth/logout', methods=['POST'])
def logout():
    """Logout endpoint"""
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully'})

@app.route('/auth/me', methods=['GET'])
@login_required
def get_current_user():
    """Get current logged in user"""
    user = User.query.get(session['user_id'])
    return jsonify(user.to_dict())

@app.route('/auth/change-password', methods=['POST'])
@login_required
def change_password():
    """Change user password"""
    data = request.json
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    
    if not current_password or not new_password:
        return jsonify({'error': 'Current and new password required'}), 400
    
    user = db.session.get(User, session['user_id'])

    
    if not user.check_password(current_password):
        return jsonify({'error': 'Current password is incorrect'}), 401
    
    user.set_password(new_password)
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Password changed successfully'})

# ============= ADMIN ROUTES =============

@app.route('/admin/members', methods=['GET'])
@login_required
def get_all_members():
    """Get all members"""
    members = Member.query.all()
    return jsonify([member.to_dict() for member in members])

@app.route('/admin/members', methods=['POST'])
@login_required
def add_member():
    """Add a single member"""
    data = request.json
    
    # Validate required fields
    required_fields = ['name', 'member_number', 'id_number', 'zone']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400
    
    # Check if member number already exists
    existing = Member.query.filter_by(member_number=data['member_number']).first()
    if existing:
        return jsonify({'error': 'Member number already exists'}), 400
    
    new_member = Member(
        name=data['name'],
        member_number=data['member_number'],
        id_number=data['id_number'],
        zone=data['zone']
    )
    
    try:
        db.session.add(new_member)
        db.session.commit()
        return jsonify(new_member.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/admin/members/bulk-upload', methods=['POST'])
@login_required
def bulk_upload():
    """Upload members from Excel file"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Only Excel files (.xlsx, .xls) are allowed'}), 400
    
    try:
        # Read Excel file
        df = pd.read_excel(file)
        
        # Validate required columns
        required_columns = ['name', 'member_number', 'id_number', 'zone']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            return jsonify({
                'error': f'Missing required columns: {", ".join(missing_columns)}'
            }), 400
        
        # Process data
        added_count = 0
        skipped_count = 0
        errors = []
        
        for index, row in df.iterrows():
            try:
                # Skip rows with missing data
                if pd.isna(row['name']) or pd.isna(row['member_number']) or \
                   pd.isna(row['id_number']) or pd.isna(row['zone']):
                    skipped_count += 1
                    errors.append(f"Row {index + 2}: Missing required data")
                    continue
                
                # Check if member already exists
                existing = Member.query.filter_by(
                    member_number=str(row['member_number'])
                ).first()
                
                if existing:
                    skipped_count += 1
                    errors.append(f"Row {index + 2}: Member number {row['member_number']} already exists")
                    continue
                
                # Create new member
                new_member = Member(
                    name=str(row['name']).strip(),
                    member_number=str(row['member_number']).strip(),
                    id_number=str(row['id_number']).strip(),
                    zone=str(row['zone']).strip()
                )
                
                db.session.add(new_member)
                added_count += 1
                
            except Exception as e:
                skipped_count += 1
                errors.append(f"Row {index + 2}: {str(e)}")
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'added': added_count,
            'skipped': skipped_count,
            'errors': errors if errors else None
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to process file: {str(e)}'}), 500

@app.route('/admin/members/<int:member_id>', methods=['PUT'])
@login_required
def update_member(member_id):
    """Update a member"""
    member = Member.query.get_or_404(member_id)
    data = request.json
    
    member.name = data.get('name', member.name)
    member.member_number = data.get('member_number', member.member_number)
    member.id_number = data.get('id_number', member.id_number)
    member.zone = data.get('zone', member.zone)
    
    try:
        db.session.commit()
        return jsonify(member.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/admin/members/<int:member_id>', methods=['DELETE'])
@login_required
def delete_member(member_id):
    """Delete a member"""
    member = Member.query.get_or_404(member_id)
    
    try:
        db.session.delete(member)
        db.session.commit()
        return jsonify({'message': 'Member deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/admin/members/delete-all', methods=['DELETE'])
@login_required
def delete_all_members():
    """Delete all members (use with caution)"""
    try:
        num_deleted = db.session.query(Member).delete()
        db.session.commit()
        return jsonify({
            'message': f'Successfully deleted {num_deleted} members'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ============= PUBLIC ROUTES =============

@app.route('/search', methods=['POST'])
def search_member():
    """Search for a member by member number and ID number"""
    data = request.json
    member_number = data.get('member_number', '').strip()
    id_number = data.get('id_number', '').strip()
    
    if not member_number or not id_number:
        return jsonify({
            'error': 'Both member number and ID number are required'
        }), 400
    
    member = Member.query.filter_by(
        member_number=member_number,
        id_number=id_number
    ).first()
    
    if member:
        return jsonify({
            'found': True,
            'member': member.to_dict()
        })
    else:
        return jsonify({
            'found': False,
            'message': 'No member found with the provided details'
        })

# ============= UTILITY ROUTES =============

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'message': 'SACCO API is running'})

@app.route('/admin/stats', methods=['GET'])
@login_required
def get_stats():
    """Get database statistics"""
    total_members = Member.query.count()
    zones = db.session.query(Member.zone).distinct().all()
    
    return jsonify({
        'total_members': total_members,
        'total_zones': len(zones),
        'zones': [z[0] for z in zones]
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)