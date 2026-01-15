from flask import Flask, request, jsonify, session, send_file
from flask_cors import CORS
from models import db, Member, User, Verification, CorrectionRequest, SearchLog
import pandas as pd
import os
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
from functools import wraps
from sqlalchemy import or_, Index
from flask_migrate import Migrate, upgrade
from flask_mail import Mail, Message
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib import colors
from io import BytesIO

app = Flask(__name__)

# ============= CONFIGURATION =============
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-only-secret-key-change-me')
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_NAME'] = 'session'
app.config['SESSION_COOKIE_DOMAIN'] = None
app.config['SESSION_COOKIE_PATH'] = '/'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=24)

# Email Configuration
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'True') == 'True'
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME', '')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD', '')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER', 'noreply@chunasacco.com')
app.config['ADMIN_EMAIL'] = os.environ.get('ADMIN_EMAIL', 'admin@chunasacco.com')

mail = Mail(app)

# CORS Configuration
CORS(app, resources={r"/*": {
    "origins": ["http://localhost:5173", "http://127.0.0.1:5173", "https://member-retrieval-zgdp.vercel.app"],
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"],
    "expose_headers": ["Set-Cookie"],
    "supports_credentials": True,
    "max_age": 3600
}})

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

db.init_app(app)
migrate = Migrate(app, db)

import os
from sqlalchemy.exc import OperationalError

def run_migrations():
    if os.getenv("RUN_MIGRATIONS", "true").lower() != "true":
        return

    with app.app_context():
        try:
            upgrade()
            print("✅ Database migrations applied")
        except OperationalError as e:
            print("⚠️ Database not ready, skipping migrations:", e)
        except Exception as e:
            print("❌ Migration error:", e)

run_migrations()


def create_indexes():
    with app.app_context():
        try:
            db.session.execute(db.text('CREATE INDEX IF NOT EXISTS idx_member_number ON members(member_number)'))
            db.session.execute(db.text('CREATE INDEX IF NOT EXISTS idx_id_number ON members(id_number)'))
            db.session.execute(db.text('CREATE INDEX IF NOT EXISTS idx_name ON members(name)'))
            db.session.execute(db.text('CREATE INDEX IF NOT EXISTS idx_composite_search ON members(member_number, id_number)'))
            db.session.execute(db.text('CREATE INDEX IF NOT EXISTS idx_search_logs_date ON search_logs(searched_at)'))
            db.session.commit()
            print("✅ Database indexes created successfully")
        except Exception as e:
            print(f"⚠️ Index creation: {str(e)}")

with app.app_context():
    # db.create_all()
    create_indexes()
    
    # Only create default user if tables exist and are properly structured
    try:
        if User.query.count() == 0:
            default_admin = User(username='admin', email='admin@sacco.com', role='super_admin')
            default_admin.set_password('admin123')
            db.session.add(default_admin)
            db.session.commit()
            print("✅ Default super admin created: username='admin', password='admin123'")
    except Exception as e:
        print(f"⚠️  Default user creation skipped: {str(e)}")
        print("💡 Run 'flask db upgrade' to apply migrations first")
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

def permission_required(permission):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                return jsonify({'error': 'Authentication required'}), 401
            user = User.query.get(session['user_id'])
            if not user or not user.has_permission(permission):
                return jsonify({'error': 'Permission denied'}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def get_client_ip():
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0]
    return request.remote_addr

# ============= AUTHENTICATION ROUTES =============

@app.route('/auth/login', methods=['POST'])
def login():
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
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully'})

@app.route('/auth/me', methods=['GET'])
@login_required
def get_current_user():
    user = User.query.get(session['user_id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(user.to_dict())

@app.route('/auth/change-password', methods=['POST'])
@login_required
def change_password():
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

# ============= USER MANAGEMENT ROUTES (Super Admin Only) =============

@app.route('/admin/users', methods=['GET'])
@permission_required('manage_users')
def get_all_users():
    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify([user.to_dict() for user in users])

@app.route('/admin/users', methods=['POST'])
@permission_required('manage_users')
def create_user():
    data = request.json
    
    required_fields = ['username', 'email', 'password', 'role']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400
    
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already exists'}), 400
    
    valid_roles = ['super_admin', 'member_manager', 'verification_viewer', 'correction_viewer']
    if data['role'] not in valid_roles:
        return jsonify({'error': f'Invalid role. Must be one of: {", ".join(valid_roles)}'}), 400
    
    new_user = User(
        username=data['username'].strip(),
        email=data['email'].strip(),
        role=data['role'],
        created_by=session['user_id']
    )
    new_user.set_password(data['password'])
    
    try:
        db.session.add(new_user)
        db.session.commit()
        return jsonify(new_user.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/admin/users/<int:user_id>', methods=['PUT'])
@permission_required('manage_users')
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.json
    
    if data.get('username'):
        existing = User.query.filter_by(username=data['username']).first()
        if existing and existing.id != user_id:
            return jsonify({'error': 'Username already exists'}), 400
        user.username = data['username'].strip()
    
    if data.get('email'):
        existing = User.query.filter_by(email=data['email']).first()
        if existing and existing.id != user_id:
            return jsonify({'error': 'Email already exists'}), 400
        user.email = data['email'].strip()
    
    if data.get('role'):
        valid_roles = ['super_admin', 'member_manager', 'verification_viewer', 'correction_viewer']
        if data['role'] not in valid_roles:
            return jsonify({'error': f'Invalid role'}), 400
        user.role = data['role']
    
    if 'is_active' in data:
        user.is_active = data['is_active']
    
    if data.get('password'):
        user.set_password(data['password'])
    
    try:
        db.session.commit()
        return jsonify(user.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/admin/users/<int:user_id>', methods=['DELETE'])
@permission_required('manage_users')
def delete_user(user_id):
    if user_id == session['user_id']:
        return jsonify({'error': 'Cannot delete your own account'}), 400
    
    user = User.query.get_or_404(user_id)
    
    try:
        db.session.delete(user)
        db.session.commit()
        return jsonify({'message': 'User deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/admin/roles', methods=['GET'])
@login_required
def get_available_roles():
    roles = [
        {'value': 'super_admin', 'label': 'Super Admin', 'description': 'Full access to all features'},
        {'value': 'member_manager', 'label': 'Member Manager', 'description': 'Manage members, view verifications and corrections'},
        {'value': 'verification_viewer', 'label': 'Verification Viewer', 'description': 'View verification records only'},
        {'value': 'correction_viewer', 'label': 'Correction Viewer', 'description': 'View and manage correction requests'}
    ]
    return jsonify(roles)

# ============= MEMBER MANAGEMENT ROUTES =============

@app.route('/admin/members', methods=['GET'])
@permission_required('manage_members')
def get_all_members():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    search = request.args.get('search', '', type=str).strip()
    
    per_page = min(per_page, 100)
    query = Member.query
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(or_(
            Member.name.ilike(search_pattern),
            Member.member_number.ilike(search_pattern),
            Member.id_number.ilike(search_pattern),
            Member.zone.ilike(search_pattern)
        ))
    
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
@permission_required('manage_members')
def add_member():
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
@permission_required('manage_members')
def bulk_upload():
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
            return jsonify({'error': f'Missing required columns: {", ".join(missing_columns)}'}), 400
        
        existing_numbers = {m.member_number for m in db.session.query(Member.member_number).all()}
        
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
@permission_required('manage_members')
def update_member(member_id):
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
    

@app.route('/admin/members/bulk-update', methods=['POST'])
@permission_required('manage_members')
def bulk_update_members():
    """
    Bulk update members from uploaded Excel file
    Expected columns: member_number (required for matching), name, id_number, zone, status
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    
    if file.filename == '' or not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file. Please upload an Excel file (.xlsx or .xls)'}), 400
    
    try:
        df = pd.read_excel(file)
        
        # member_number is required to identify which record to update
        if 'member_number' not in df.columns:
            return jsonify({'error': 'Missing required column: member_number'}), 400
        
        # Track statistics
        updated_count = 0
        not_found_count = 0
        error_count = 0
        errors = []
        
        for index, row in df.iterrows():
            try:
                # Skip rows with missing member_number
                if pd.isna(row['member_number']):
                    error_count += 1
                    errors.append(f"Row {index + 2}: Missing member_number")
                    continue
                
                member_num = str(row['member_number']).strip()
                
                # Find the member
                member = Member.query.filter_by(member_number=member_num).first()
                
                if not member:
                    not_found_count += 1
                    errors.append(f"Row {index + 2}: Member {member_num} not found")
                    continue
                
                # Update fields if they exist in the Excel and are not empty
                if 'name' in df.columns and not pd.isna(row['name']):
                    member.name = str(row['name']).strip()
                
                if 'id_number' in df.columns and not pd.isna(row['id_number']):
                    member.id_number = str(row['id_number']).strip()
                
                if 'zone' in df.columns and not pd.isna(row['zone']):
                    member.zone = str(row['zone']).strip()
                
                if 'status' in df.columns and not pd.isna(row['status']):
                    member.status = str(row['status']).strip()
                
                updated_count += 1
                
            except Exception as e:
                error_count += 1
                errors.append(f"Row {index + 2}: {str(e)}")
        
        # Commit all changes at once
        if updated_count > 0:
            db.session.commit()
        
        return jsonify({
            'success': True,
            'updated': updated_count,
            'not_found': not_found_count,
            'errors': error_count,
            'error_details': errors[:20] if errors else None,
            'message': f'Successfully updated {updated_count} members'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to process file: {str(e)}'}), 500


@app.route('/admin/members/bulk-update-json', methods=['POST'])
@permission_required('manage_members')
def bulk_update_members_json():
    """
    Bulk update members from JSON data
    Expected format: { "updates": [{ "member_number": "...", "name": "...", ... }] }
    """
    data = request.json
    updates = data.get('updates', [])
    
    if not updates or not isinstance(updates, list):
        return jsonify({'error': 'Please provide a list of updates'}), 400
    
    try:
        updated_count = 0
        not_found_count = 0
        error_count = 0
        errors = []
        
        for idx, update_data in enumerate(updates):
            try:
                member_num = update_data.get('member_number')
                
                if not member_num:
                    error_count += 1
                    errors.append(f"Update {idx + 1}: Missing member_number")
                    continue
                
                member = Member.query.filter_by(member_number=member_num).first()
                
                if not member:
                    not_found_count += 1
                    errors.append(f"Update {idx + 1}: Member {member_num} not found")
                    continue
                
                # Update provided fields
                if 'name' in update_data and update_data['name']:
                    member.name = update_data['name'].strip()
                
                if 'id_number' in update_data and update_data['id_number']:
                    member.id_number = update_data['id_number'].strip()
                
                if 'zone' in update_data and update_data['zone']:
                    member.zone = update_data['zone'].strip()
                
                if 'status' in update_data and update_data['status']:
                    member.status = update_data['status'].strip()
                
                updated_count += 1
                
            except Exception as e:
                error_count += 1
                errors.append(f"Update {idx + 1}: {str(e)}")
        
        if updated_count > 0:
            db.session.commit()
        
        return jsonify({
            'success': True,
            'updated': updated_count,
            'not_found': not_found_count,
            'errors': error_count,
            'error_details': errors[:20] if errors else None,
            'message': f'Successfully updated {updated_count} members'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/admin/members/<int:member_id>', methods=['DELETE'])
@permission_required('manage_members')
def delete_member(member_id):
    member = Member.query.get_or_404(member_id)
    
    try:
        db.session.delete(member)
        db.session.commit()
        return jsonify({'message': 'Member deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/admin/members/bulk-delete', methods=['POST'])
@permission_required('manage_members')
def bulk_delete_members():
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
    total_members = Member.query.count()
    zones = db.session.query(Member.zone).distinct().all()
    total_verifications = Verification.query.count()
    pending_corrections = CorrectionRequest.query.filter_by(status='pending').count()
    total_searches = SearchLog.query.count()
    successful_searches = SearchLog.query.filter_by(search_successful=True).count()
    
    return jsonify({
        'total_members': total_members,
        'total_zones': len(zones),
        'zones': [z[0] for z in zones],
        'total_verifications': total_verifications,
        'pending_corrections': pending_corrections,
        'total_searches': total_searches,
        'successful_searches': successful_searches
    })

# ============= VERIFICATION ROUTES =============

@app.route('/admin/verifications', methods=['GET'])
@permission_required('view_verifications')
def get_verifications():
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

# ============= CORRECTION ROUTES =============

@app.route('/admin/corrections', methods=['GET'])
@permission_required('view_corrections')
def get_corrections():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status', 'all')
    search = request.args.get('search', '', type=str).strip()  # ADD THIS LINE
    
    try:
        query = CorrectionRequest.query
        
        # Status filter
        if status != 'all':
            query = query.filter_by(status=status)
        
        # Search filter - ADD THIS BLOCK
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(or_(
                CorrectionRequest.member_number.ilike(search_pattern),
                CorrectionRequest.id_number.ilike(search_pattern),
                CorrectionRequest.current_name.ilike(search_pattern),
                CorrectionRequest.correct_name.ilike(search_pattern),
                CorrectionRequest.current_zone.ilike(search_pattern),
                CorrectionRequest.correct_zone.ilike(search_pattern),
                CorrectionRequest.email.ilike(search_pattern),
                CorrectionRequest.phone.ilike(search_pattern)
            ))
        
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
@permission_required('manage_corrections')
def resolve_correction(correction_id):
    try:
        correction = CorrectionRequest.query.get_or_404(correction_id)
        correction.status = 'resolved'
        correction.resolved_at = datetime.utcnow()
        correction.resolved_by = session.get('user_id')
        
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Correction marked as resolved'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ============= SEARCH LOGS =============

@app.route('/admin/search-logs', methods=['GET'])
@login_required
def get_search_logs():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    success_filter = request.args.get('success', 'all')
    
    try:
        query = SearchLog.query
        
        if success_filter == 'successful':
            query = query.filter_by(search_successful=True)
        elif success_filter == 'failed':
            query = query.filter_by(search_successful=False)
        
        query = query.order_by(SearchLog.searched_at.desc())
        logs = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'logs': [log.to_dict() for log in logs.items],
            'total': logs.total,
            'page': page,
            'per_page': per_page,
            'pages': logs.pages
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============= PUBLIC ROUTES =============

@app.route('/search', methods=['POST'])
def search_member():
    data = request.json
    member_number = data.get('member_number', '').strip()
    id_number = data.get('id_number', '').strip()
    
    if not member_number or not id_number:
        return jsonify({'error': 'Both member number and ID number are required'}), 400
    
    member = Member.query.filter_by(member_number=member_number, id_number=id_number).first()
    
    # Log the search
    search_log = SearchLog(
        member_id=member.id if member else None,
        member_number=member_number,
        id_number=id_number,
        search_successful=member is not None,
        ip_address=get_client_ip(),
        user_agent=request.headers.get('User-Agent', '')[:500]
    )
    
    try:
        db.session.add(search_log)
        db.session.commit()
    except Exception as e:
        print(f"Failed to log search: {str(e)}")
    
    if member:
        return jsonify({'found': True, 'member': member.to_dict()})
    else:
        return jsonify({'found': False, 'message': 'No member found with the provided details'})

@app.route('/verify-details', methods=['POST'])
def verify_details():
    data = request.json
    
    try:
        member = Member.query.get(data['member_id'])
        
        if not member or member.member_number != data['member_number']:
            return jsonify({'error': 'Member not found'}), 404
        
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
        
        return jsonify({'success': True, 'message': 'Details verified successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Verification error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/submit-correction', methods=['POST'])
def submit_correction():
    data = request.json
    
    try:
        member = Member.query.get(data['member_id'])
        
        if not member or member.member_number != data['member_number']:
            return jsonify({'error': 'Member not found'}), 404
        
        if not data.get('email') and not data.get('phone'):
            return jsonify({'error': 'Please provide either email or phone number'}), 400
        
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
        
        try:
            if app.config['MAIL_USERNAME']:
                msg = Message(
                    subject=f'Member Correction Request - {data["member_number"]}',
                    recipients=[app.config['ADMIN_EMAIL']],
                    body=f"""
                                New correction request received:

                                Member Number: {data['member_number']}
                                ID Number: {data['id_number']}

                                CURRENT DETAILS:
                                • Name: {data['current_name']}
                                • Zone: {data['current_zone']}
                                • Status: {data['current_status']}

                                REQUESTED CORRECTIONS:
                                • Name: {data['correct_name']}
                                • Zone: {data['correct_zone']}

                                CONTACT:
                                • Email: {data.get('email', 'Not provided')}
                                • Phone: {data.get('phone', 'Not provided')}

                                Additional Notes: {data.get('additional_notes', 'None')}
                                                    """.strip()
                )
                mail.send(msg)
        except Exception as e:
            print(f"⚠️ Email failed: {e}")
        
        return jsonify({'success': True, 'message': 'Correction request submitted successfully', 'correction_id': correction.id}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/admin/corrections/<int:correction_id>/download-pdf', methods=['GET'])
@permission_required('view_corrections')
def download_correction_pdf(correction_id):
    """Generate and download PDF for a specific correction request"""
    try:
        print(f"📄 Starting PDF generation for correction {correction_id}")
        correction = CorrectionRequest.query.get_or_404(correction_id)
        print(f"✅ Found correction: {correction.member_number}")
        
        # Create PDF in memory
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72,
                              topMargin=72, bottomMargin=18)
        
        # Container for PDF elements
        elements = []
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#166534'),
            spaceAfter=30,
            alignment=1  # Center
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#166534'),
            spaceAfter=12,
            spaceBefore=12
        )
        
        # Title
        title = Paragraph("Member Correction Request", title_style)
        elements.append(title)
        elements.append(Spacer(1, 0.2*inch))
        
        # Request Information
        elements.append(Paragraph("Request Information", heading_style))
        
        request_data = [
            ['Request ID:', str(correction.id)],
            ['Status:', correction.status.upper()],
            ['Submitted:', correction.submitted_at.strftime('%B %d, %Y at %I:%M %p')],
        ]
        
        if correction.resolved_at:
            request_data.append(['Resolved:', correction.resolved_at.strftime('%B %d, %Y at %I:%M %p')])
        
        request_table = Table(request_data, colWidths=[2*inch, 4*inch])
        request_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F3F4F6')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E5E7EB'))
        ]))
        elements.append(request_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Member Identification
        elements.append(Paragraph("Member Identification", heading_style))
        
        id_data = [
            ['Member Number:', correction.member_number],
            ['ID Number:', correction.id_number],
        ]
        
        id_table = Table(id_data, colWidths=[2*inch, 4*inch])
        id_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F3F4F6')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E5E7EB'))
        ]))
        elements.append(id_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Comparison Table
        elements.append(Paragraph("Requested Changes", heading_style))
        
        comparison_data = [
            ['Field', 'Current Information', 'Requested Correction'],
            ['Name', correction.current_name, correction.correct_name],
            ['Working Station', correction.current_zone, correction.correct_zone],
            ['Status', correction.current_status, '-']
        ]
        
        comparison_table = Table(comparison_data, colWidths=[1.5*inch, 2.25*inch, 2.25*inch])
        comparison_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#166534')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('TOPPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 10),
            ('TOPPADDING', (0, 1), (-1, -1), 10),
        ]))
        elements.append(comparison_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Contact Information
        elements.append(Paragraph("Contact Information", heading_style))
        
        contact_data = [
            ['Email:', correction.email or 'Not provided'],
            ['Phone:', correction.phone or 'Not provided'],
        ]
        
        contact_table = Table(contact_data, colWidths=[2*inch, 4*inch])
        contact_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F3F4F6')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E5E7EB'))
        ]))
        elements.append(contact_table)
        
        # Additional Notes
        if correction.additional_notes:
            elements.append(Spacer(1, 0.3*inch))
            elements.append(Paragraph("Additional Notes", heading_style))
            notes_style = ParagraphStyle(
                'Notes',
                parent=styles['BodyText'],
                fontSize=10,
                leading=14
            )
            elements.append(Paragraph(correction.additional_notes, notes_style))
        
        # Build PDF
        doc.build(elements)
        
        # Prepare response
        buffer.seek(0)
        filename = f"correction_request_{correction.id}_{correction.member_number}.pdf"
        
        return send_file(
            buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        print(f"❌ PDF Generation Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/admin/corrections/download-all-pdf', methods=['GET'])
@permission_required('view_corrections')
def download_all_corrections_pdf():
    """Generate and download PDF for all correction requests"""
    try:
        print("📄 Starting bulk PDF generation")
        status = request.args.get('status', 'all')
        print(f"Filter status: {status}")
        
        query = CorrectionRequest.query
        if status != 'all':
            query = query.filter_by(status=status)
        
        corrections = query.order_by(CorrectionRequest.submitted_at.desc()).all()
        print(f"✅ Found {len(corrections)} corrections")
        
        if not corrections:
            return jsonify({'error': 'No corrections found'}), 404
        
        # Create PDF in memory
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=50, leftMargin=50,
                              topMargin=50, bottomMargin=30)
        
        elements = []
        styles = getSampleStyleSheet()
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=20,
            textColor=colors.HexColor('#166534'),
            spaceAfter=20,
            alignment=1
        )
        
        title = Paragraph("Member Correction Requests Report", title_style)
        elements.append(title)
        
        subtitle = Paragraph(
            f"Generated: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}<br/>Total Requests: {len(corrections)}",
            ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=10, alignment=1, textColor=colors.grey)
        )
        elements.append(subtitle)
        elements.append(Spacer(1, 0.3*inch))
        
        # Summary table data
        table_data = [['ID', 'Member #', 'Zone Change', 'Status', 'Submitted']]
        
        for c in corrections:
            zone_change = f"{c.current_zone} → {c.correct_zone}"
            if len(zone_change) > 35:
                zone_change = zone_change[:32] + "..."
            
            table_data.append([
                str(c.id),
                c.member_number,
                zone_change,
                c.status.upper(),
                c.submitted_at.strftime('%Y-%m-%d')
            ])
        
        # Create table
        table = Table(table_data, colWidths=[0.5*inch, 1*inch, 2.5*inch, 0.8*inch, 1*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#166534')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('TOPPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
        ]))
        
        elements.append(table)
        
        # Build PDF
        doc.build(elements)
        
        buffer.seek(0)
        filename = f"all_corrections_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        
        return send_file(
            buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        print(f"❌ PDF Generation Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
# ============= UTILITY ROUTES =============

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'SACCO API is running'})

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
    print(f"👤 Default Super Admin: username='admin', password='admin123'")
    print(f"📧 Email: {'CONFIGURED' if app.config['MAIL_USERNAME'] else 'NOT CONFIGURED'}")
    print(f"✅ RBAC & Search Logging: ENABLED")
    print("="*60 + "\n")
    
    app.run(debug=True, port=5000)