from flask import Flask, request, jsonify, session
from flask_cors import CORS
from models import db, Member, User
import pandas as pd
import os
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
from functools import wraps
from sqlalchemy import or_, Index

app = Flask(__name__)

# ============= CONFIGURATION =============

# Session Configuration - MUST be set BEFORE CORS
app.config['SECRET_KEY'] = os.environ.get(
    'SECRET_KEY',
    'dev-only-secret-key-change-me'
)
app.config['SESSION_COOKIE_SAMESITE'] = None  # Remove SameSite entirely for local development
app.config['SESSION_COOKIE_SECURE'] = True  # Set to True in production with HTTPS
app.config['SESSION_COOKIE_HTTPONLY'] = True  # Disable for debugging
app.config['SESSION_COOKIE_NAME'] = 'session'
app.config['SESSION_COOKIE_DOMAIN'] = None  # Don't restrict domain
app.config['SESSION_COOKIE_PATH'] = '/'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=24)

# CORS Configuration - CRITICAL: Must include supports_credentials
CORS(app, 
     resources={
         r"/*": {
             "origins": ["http://localhost:5173", "http://127.0.0.1:5173", "https://member-retrieval-zgdp.vercel.app/"],
             "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
             "allow_headers": ["Content-Type", "Authorization"],
             "expose_headers": ["Set-Cookie"],
             "supports_credentials": True,
             "max_age": 3600
         }
     })

# Database Configuration
DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///sacco_members.db')
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
ALLOWED_EXTENSIONS = {'xlsx', 'xls'}

# Create upload folder if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize database
db.init_app(app)

def create_indexes():
    """Create database indexes for fast searches"""
    with app.app_context():
        try:
            # Create indexes using raw SQL for SQLite compatibility
            db.session.execute(db.text('''
                CREATE INDEX IF NOT EXISTS idx_member_number ON members(member_number)
            '''))
            db.session.execute(db.text('''
                CREATE INDEX IF NOT EXISTS idx_id_number ON members(id_number)
            '''))
            db.session.execute(db.text('''
                CREATE INDEX IF NOT EXISTS idx_name ON members(name)
            '''))
            db.session.execute(db.text('''
                CREATE INDEX IF NOT EXISTS idx_composite_search ON members(member_number, id_number)
            '''))
            db.session.commit()
            print("✅ Database indexes created successfully")
        except Exception as e:
            print(f"⚠️ Index creation: {str(e)}")

with app.app_context():
    db.create_all()
    create_indexes()  # Create indexes after tables
    
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
        print("✅ Default admin user created: username='admin', password='admin123'")

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Authentication decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        print(f"🔐 Checking auth for {request.path}")
        print(f"📦 Session data: {dict(session)}")
        
        if 'user_id' not in session:
            print("❌ No user_id in session")
            return jsonify({'error': 'Authentication required'}), 401
        
        print(f"✅ User authenticated: {session.get('username')}")
        return f(*args, **kwargs)
    return decorated_function

# ============= AUTHENTICATION ROUTES =============

@app.route('/auth/login', methods=['POST'])
def login():
    """Login endpoint"""
    print("🔵 Login attempt received")
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    user = User.query.filter_by(username=username).first()
    
    if user and user.check_password(password) and user.is_active:
        session.permanent = True  # Make session permanent
        session['user_id'] = user.id
        session['username'] = user.username
        session['role'] = user.role
        
        print(f"✅ Login successful for user: {username}")
        print(f"📦 Session set: {dict(session)}")
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        response = jsonify({
            'success': True,
            'message': 'Login successful',
            'user': user.to_dict()
        })
        
        return response
    
    print(f"❌ Login failed for user: {username}")
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/auth/logout', methods=['POST'])
def logout():
    """Logout endpoint"""
    print(f"🔵 Logout for user: {session.get('username')}")
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully'})

@app.route('/auth/me', methods=['GET'])
@login_required
def get_current_user():
    """Get current logged in user"""
    print(f"🔵 Getting current user: {session.get('username')}")
    user = User.query.get(session['user_id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404
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

# ============= ADMIN ROUTES (OPTIMIZED) =============

@app.route('/admin/members', methods=['GET'])
@login_required
def get_all_members():
    """Get members with pagination and search - OPTIMIZED"""
    print(f"🔵 Fetching members for: {session.get('username')}")
    
    # Get pagination parameters
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    search = request.args.get('search', '', type=str).strip()
    
    # Limit per_page to prevent abuse
    per_page = min(per_page, 100)
    
    # Build query
    query = Member.query
    
    # Apply search filter if provided
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Member.name.ilike(search_pattern),
                Member.member_number.ilike(search_pattern),
                Member.id_number.ilike(search_pattern),
                Member.zone.ilike(search_pattern)
            )
        )
    
    # Order by name for consistent pagination
    query = query.order_by(Member.name)
    
    # Get total count for pagination
    total = query.count()
    
    # Apply pagination
    members = query.paginate(page=page, per_page=per_page, error_out=False)
    
    print(f"✅ Returning {len(members.items)} members (Page {page}/{members.pages}, Total: {total})")
    
    return jsonify({
        'members': [member.to_dict() for member in members.items],
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': members.pages,
        'has_next': members.has_next,
        'has_prev': members.has_prev
    })

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
    
    # Check if member number already exists (uses index for speed)
    existing = Member.query.filter_by(member_number=data['member_number']).first()
    if existing:
        return jsonify({'error': 'Member number already exists'}), 400
    
    new_member = Member(
        name=data['name'].strip(),
        member_number=data['member_number'].strip(),
        id_number=data['id_number'].strip(),
        zone=data['zone'].strip()
    )
    
    try:
        db.session.add(new_member)
        db.session.commit()
        print(f"✅ Member added: {data['name']}")
        return jsonify(new_member.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error adding member: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/admin/members/bulk-upload', methods=['POST'])
@login_required
def bulk_upload():
    """Upload members from Excel file - OPTIMIZED"""
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
        
        # Get existing member numbers for faster lookup (uses index)
        existing_numbers = {m.member_number for m in 
                          db.session.query(Member.member_number).all()}
        
        # Process data
        added_count = 0
        skipped_count = 0
        errors = []
        new_members = []
        
        for index, row in df.iterrows():
            try:
                # Skip rows with missing data
                if pd.isna(row['name']) or pd.isna(row['member_number']) or \
                   pd.isna(row['id_number']) or pd.isna(row['zone']):
                    skipped_count += 1
                    errors.append(f"Row {index + 2}: Missing required data")
                    continue
                
                member_num = str(row['member_number']).strip()
                
                # Check if member already exists (in-memory check, much faster)
                if member_num in existing_numbers:
                    skipped_count += 1
                    errors.append(f"Row {index + 2}: Member number {member_num} already exists")
                    continue
                
                # Create new member (but don't commit yet)
                new_member = Member(
                    name=str(row['name']).strip(),
                    member_number=member_num,
                    id_number=str(row['id_number']).strip(),
                    zone=str(row['zone']).strip()
                )
                
                new_members.append(new_member)
                existing_numbers.add(member_num)  # Add to set to prevent duplicates in same file
                added_count += 1
                
            except Exception as e:
                skipped_count += 1
                errors.append(f"Row {index + 2}: {str(e)}")
        
        # Bulk insert all new members at once (much faster than individual inserts)
        if new_members:
            db.session.bulk_save_objects(new_members)
            db.session.commit()
        
        print(f"✅ Bulk upload complete: {added_count} added, {skipped_count} skipped")
        
        return jsonify({
            'success': True,
            'added': added_count,
            'skipped': skipped_count,
            'errors': errors[:20] if errors else None  # Limit errors to first 20
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Bulk upload error: {str(e)}")
        return jsonify({'error': f'Failed to process file: {str(e)}'}), 500

@app.route('/admin/members/<int:member_id>', methods=['PUT'])
@login_required
def update_member(member_id):
    """Update a member"""
    member = Member.query.get_or_404(member_id)
    data = request.json
    
    member.name = data.get('name', member.name).strip()
    member.member_number = data.get('member_number', member.member_number).strip()
    member.id_number = data.get('id_number', member.id_number).strip()
    member.zone = data.get('zone', member.zone).strip()
    
    try:
        db.session.commit()
        print(f"✅ Member updated: {member.name}")
        return jsonify(member.to_dict())
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error updating member: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/admin/members/<int:member_id>', methods=['DELETE'])
@login_required
def delete_member(member_id):
    """Delete a member"""
    member = Member.query.get_or_404(member_id)
    member_name = member.name
    
    try:
        db.session.delete(member)
        db.session.commit()
        print(f"✅ Member deleted: {member_name}")
        return jsonify({'message': 'Member deleted successfully'})
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error deleting member: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/admin/members/delete-all', methods=['DELETE'])
@login_required
def delete_all_members():
    """Delete all members (use with caution)"""
    try:
        num_deleted = db.session.query(Member).delete()
        db.session.commit()
        print(f"⚠️ All members deleted: {num_deleted} records")
        return jsonify({
            'message': f'Successfully deleted {num_deleted} members'
        })
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error deleting all members: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ============= PUBLIC ROUTES (OPTIMIZED) =============

@app.route('/search', methods=['POST'])
def search_member():
    """Search for a member by member number and ID number - OPTIMIZED with indexes"""
    data = request.json
    member_number = data.get('member_number', '').strip()
    id_number = data.get('id_number', '').strip()
    
    if not member_number or not id_number:
        return jsonify({
            'error': 'Both member number and ID number are required'
        }), 400
    
    # This query will use the composite index for ultra-fast lookup
    member = Member.query.filter_by(
        member_number=member_number,
        id_number=id_number
    ).first()
    
    if member:
        print(f"✅ Member found: {member.name}")
        return jsonify({
            'found': True,
            'member': member.to_dict()
        })
    else:
        print(f"❌ No member found for: {member_number}")
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
    print(f"🔵 Fetching stats for: {session.get('username')}")
    total_members = Member.query.count()
    zones = db.session.query(Member.zone).distinct().all()
    
    return jsonify({
        'total_members': total_members,
        'total_zones': len(zones),
        'zones': [z[0] for z in zones]
    })

# ============= ERROR HANDLERS =============

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Resource not found'}), 404

@app.errorhandler(500)
def internal_error(e):
    db.session.rollback()
    return jsonify({'error': 'Internal server error'}), 500

# ============= REQUEST LOGGING (for debugging) =============

@app.before_request
def log_request():
    """Log incoming requests for debugging"""
    print(f"\n{'='*60}")
    print(f"📨 {request.method} {request.path}")
    print(f"🔗 Origin: {request.headers.get('Origin')}")
    print(f"🍪 Has Cookie: {'Cookie' in request.headers}")
    if 'Cookie' in request.headers:
        print(f"🍪 Cookie value: {request.headers.get('Cookie')[:50]}...")
    print(f"{'='*60}\n")

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 SACCO Management System API Starting...")
    print("="*60)
    print(f"📍 Running on: http://127.0.0.1:5000")
    print(f"🔑 Session Secret Key: {'SET' if app.config['SECRET_KEY'] else 'NOT SET'}")
    print(f"🌐 CORS Origins: http://localhost:5173, http://127.0.0.1:5173")
    print(f"🍪 Session Cookie: SameSite={app.config['SESSION_COOKIE_SAMESITE']}, Secure={app.config['SESSION_COOKIE_SECURE']}")
    print(f"👤 Default Admin: username='admin', password='admin123'")
    print(f"⚡ Database indexes: ENABLED for fast searches")
    print("="*60 + "\n")
    
    app.run(debug=True, port=5000)