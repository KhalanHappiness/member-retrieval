from flask import Flask, request, jsonify, session
from flask_cors import CORS
from models import db, Member, User, Verification, CorrectionRequest
import pandas as pd
import os
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
from functools import wraps
from sqlalchemy import or_, Index
from flask_migrate import Migrate
from flask_mail import Mail, Message

app = Flask(__name__)

# ============= CONFIGURATION =============

# Session Configuration
app.config['SECRET_KEY'] = os.environ.get(
    'SECRET_KEY',
    'dev-only-secret-key-change-me'
)
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_NAME'] = 'session'
app.config['SESSION_COOKIE_DOMAIN'] = None
app.config['SESSION_COOKIE_PATH'] = '/'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=24)

# Email Configuration (Flask-Mail)
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'True') == 'True'
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME', '')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD', '')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER', 'noreply@chunasacco.com')
app.config['ADMIN_EMAIL'] = os.environ.get('ADMIN_EMAIL', 'admin@chunasacco.com')

# Initialize Flask-Mail
mail = Mail(app)

# CORS Configuration
CORS(app, 
     resources={
         r"/*": {
             "origins": ["http://localhost:5173", "http://127.0.0.1:5173", "https://member-retrieval-zgdp.vercel.app"],
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
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
ALLOWED_EXTENSIONS = {'xlsx', 'xls'}

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize database
db.init_app(app)
migrate = Migrate(app, db)

def create_indexes():
    """Create database indexes for fast searches"""
    with app.app_context():
        try:
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
    create_indexes()
    
    if User.query.count() == 0:
        default_admin = User(
            username='admin',
            email='admin@sacco.com',
            role='admin'
        )
        default_admin.set_password('admin123')
        db.session.add(default_admin)
        db.session.commit()
        print("✅ Default admin user created: username='admin', password='admin123'")

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

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
        session.permanent = True
        session['user_id'] = user.id
        session['username'] = user.username
        session['role'] = user.role
        
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

# ============= ADMIN ROUTES =============

@app.route('/admin/members', methods=['GET'])
@login_required
def get_all_members():
    """Get members with pagination and search"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    search = request.args.get('search', '', type=str).strip()
    
    per_page = min(per_page, 100)
    query = Member.query
    
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
    
    query = query.order_by(Member.name)
    total = query.count()
    members = query.paginate(page=page, per_page=per_page, error_out=False)
    
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
    
    required_fields = ['name', 'member_number', 'id_number', 'zone']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400
    
    existing = Member.query.filter_by(member_number=data['member_number']).first()
    if existing:
        return jsonify({'error': 'Member number already exists'}), 400
    
    new_member = Member(
        name=data['name'].strip(),
        member_number=data['member_number'].strip(),
        id_number=data['id_number'].strip(),
        zone=data['zone'].strip(),
        status=data.get('status', 'active').strip()
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
    
    if file.filename == '' or not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file'}), 400
    
    try:
        df = pd.read_excel(file)
        required_columns = ['name', 'member_number', 'id_number', 'zone', 'status']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            return jsonify({
                'error': f'Missing required columns: {", ".join(missing_columns)}'
            }), 400
        
        existing_numbers = {m.member_number for m in 
                          db.session.query(Member.member_number).all()}
        
        added_count = 0
        skipped_count = 0
        errors = []
        new_members = []
        
        for index, row in df.iterrows():
            try:
                if pd.isna(row['name']) or pd.isna(row['member_number']) or \
                   pd.isna(row['id_number']) or pd.isna(row['zone']):
                    skipped_count += 1
                    errors.append(f"Row {index + 2}: Missing required data")
                    continue
                
                member_num = str(row['member_number']).strip()
                
                if member_num in existing_numbers:
                    skipped_count += 1
                    errors.append(f"Row {index + 2}: Member number {member_num} already exists")
                    continue
                
                new_member = Member(
                    name=str(row['name']).strip(),
                    member_number=member_num,
                    id_number=str(row['id_number']).strip(),
                    zone=str(row['zone']).strip(),
                    status=str(row['status']).strip()
                )
                
                new_members.append(new_member)
                existing_numbers.add(member_num)
                added_count += 1
                
            except Exception as e:
                skipped_count += 1
                errors.append(f"Row {index + 2}: {str(e)}")
        
        if new_members:
            db.session.bulk_save_objects(new_members)
            db.session.commit()
        
        return jsonify({
            'success': True,
            'added': added_count,
            'skipped': skipped_count,
            'errors': errors[:20] if errors else None
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
    
    member.name = data.get('name', member.name).strip()
    member.member_number = data.get('member_number', member.member_number).strip()
    member.id_number = data.get('id_number', member.id_number).strip()
    member.zone = data.get('zone', member.zone).strip()
    member.status = data.get('status', member.status).strip()
    
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

@app.route('/admin/members/bulk-delete', methods=['POST'])
@login_required
def bulk_delete_members():
    """Delete multiple members at once"""
    data = request.json
    member_ids = data.get('ids', [])
    
    if not member_ids or not isinstance(member_ids, list):
        return jsonify({'error': 'Please provide a list of member IDs'}), 400
    
    try:
        deleted_count = Member.query.filter(Member.id.in_(member_ids)).delete(synchronize_session=False)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'deleted': deleted_count,
            'message': f'Successfully deleted {deleted_count} members'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/admin/stats', methods=['GET'])
@login_required
def get_stats():
    """Get database statistics"""
    total_members = Member.query.count()
    zones = db.session.query(Member.zone).distinct().all()
    total_verifications = Verification.query.count()
    pending_corrections = CorrectionRequest.query.filter_by(status='pending').count()
    
    return jsonify({
        'total_members': total_members,
        'total_zones': len(zones),
        'zones': [z[0] for z in zones],
        'total_verifications': total_verifications,
        'pending_corrections': pending_corrections
    })

# ============= NEW: VERIFICATION ROUTES =============

@app.route('/admin/verifications', methods=['GET'])
@login_required
def get_verifications():
    """Get all verification records"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    try:
        query = Verification.query.order_by(Verification.verified_at.desc())
        verifications = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'verifications': [v.to_dict() for v in verifications.items],
            'total': verifications.total,
            'page': page,
            'per_page': per_page,
            'pages': verifications.pages
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/corrections', methods=['GET'])
@login_required
def get_corrections():
    """Get all correction requests"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status', 'all')
    
    try:
        query = CorrectionRequest.query
        
        if status != 'all':
            query = query.filter_by(status=status)
        
        query = query.order_by(CorrectionRequest.submitted_at.desc())
        corrections = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'corrections': [c.to_dict() for c in corrections.items],
            'total': corrections.total,
            'page': page,
            'per_page': per_page,
            'pages': corrections.pages
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/corrections/<int:correction_id>/resolve', methods=['POST'])
@login_required
def resolve_correction(correction_id):
    """Mark a correction request as resolved"""
    try:
        correction = CorrectionRequest.query.get_or_404(correction_id)
        correction.status = 'resolved'
        correction.resolved_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Correction marked as resolved'
        }), 200
        
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

@app.route('/verify-details', methods=['POST'])
def verify_details():
    """Record that a member has verified their details are correct"""
    data = request.json
    
    try:
        member = Member.query.get(data['member_id'])
        
        if not member or member.member_number != data['member_number']:
            return jsonify({'error': 'Member not found'}), 404
        
        # Create verification record
        verification = Verification(
            member_id=member.id,
            member_number=member.member_number,
            member_name=member.name,
            zone=member.zone,
            id_number=data['id_number']
        )
        
        db.session.add(verification)
        db.session.commit()
        
        print(f"✅ Member verified: {member.name} ({member.member_number})")
        
        return jsonify({
            'success': True,
            'message': 'Details verified successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Verification error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/submit-correction', methods=['POST'])
def submit_correction():
    """Submit a correction request for member details"""
    data = request.json
    
    try:
        member = Member.query.get(data['member_id'])
        
        if not member or member.member_number != data['member_number']:
            return jsonify({'error': 'Member not found'}), 404
        
        # Validate contact info
        if not data.get('email') and not data.get('phone'):
            return jsonify({'error': 'Please provide either email or phone number'}), 400
        
        # Create correction request
        correction = CorrectionRequest(
            member_id=member.id,
            member_number=data['member_number'],
            id_number=data['id_number'],
            current_name=data['current_name'],
            current_zone=data['current_zone'],
            current_status=data['current_status'],
            correct_name=data['correct_name'],
            correct_zone=data['correct_zone'],
            email=data.get('email'),
            phone=data.get('phone'),
            additional_notes=data.get('additional_notes')
        )
        
        db.session.add(correction)
        db.session.commit()
        
        print(f"✅ Correction request submitted: {data['member_number']}")
        
        # Send email notification to admin
        try:
            if app.config['MAIL_USERNAME']:  # Only send if email is configured
                msg = Message(
                    subject=f'Member Correction Request - {data["member_number"]}',
                    recipients=[app.config['ADMIN_EMAIL']],
                    body=f"""
                            New correction request received from Chuna DT Sacco Member Portal:

                            Member Number: {data['member_number']}
                            ID Number: {data['id_number']}

                            CURRENT DETAILS:
                            • Name: {data['current_name']}
                            • Zone: {data['current_zone']}
                            • Status: {data['current_status']}

                            REQUESTED CORRECTIONS:
                            • Name: {data['correct_name']}
                            • Zone: {data['correct_zone']}

                            CONTACT INFORMATION:
                            • Email: {data.get('email', 'Not provided')}
                            • Phone: {data.get('phone', 'Not provided')}

                            Additional Notes:
                            {data.get('additional_notes', 'None')}

                            Please review this correction request and contact the member to resolve the issue.
                            Log in to the admin panel to view all pending corrections.
                                                """.strip()
                )
                mail.send(msg)
                print(f"✅ Email sent to admin for correction request")
        except Exception as email_error:
            print(f"⚠️ Email sending failed: {email_error}")
            # Continue even if email fails
        
        return jsonify({
            'success': True,
            'message': 'Correction request submitted successfully',
            'correction_id': correction.id
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Correction submission error: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ============= UTILITY ROUTES =============

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'message': 'SACCO API is running'})

# ============= ERROR HANDLERS =============

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Resource not found'}), 404

@app.errorhandler(500)
def internal_error(e):
    db.session.rollback()
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 SACCO Management System API Starting...")
    print("="*60)
    print(f"📍 Running on: http://127.0.0.1:5000")
    print(f"👤 Default Admin: username='admin', password='admin123'")
    print(f"📧 Email: {'CONFIGURED' if app.config['MAIL_USERNAME'] else 'NOT CONFIGURED'}")
    print(f"✅ Verification & Correction features: ENABLED")
    print("="*60 + "\n")
    
    app.run(debug=True, port=5000)