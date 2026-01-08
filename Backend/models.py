from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

db = SQLAlchemy()

class Member(db.Model):
    __tablename__ = 'members'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    member_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    id_number = db.Column(db.String(50), nullable=False, index=True)
    zone = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(20), default='active')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    verifications = db.relationship('Verification', backref='member', lazy=True, cascade='all, delete-orphan')
    corrections = db.relationship('CorrectionRequest', backref='member', lazy=True, cascade='all, delete-orphan')
    search_logs = db.relationship('SearchLog', backref='member', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'member_number': self.member_number,
            'id_number': self.id_number,
            'zone': self.zone,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def __repr__(self):
        return f'<Member {self.member_number}: {self.name}>'


class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    # Role options: 'super_admin', 'member_manager', 'verification_viewer', 'correction_viewer'
    role = db.Column(db.String(30), default='member_manager')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def has_permission(self, permission):
        """Check if user has specific permission"""
        permissions = {
            'super_admin': ['manage_users', 'manage_members', 'view_verifications', 'view_corrections', 'manage_corrections'],
            'member_manager': ['manage_members', 'view_verifications', 'view_corrections'],
            'verification_viewer': ['view_verifications'],
            'correction_viewer': ['view_corrections', 'manage_corrections']
        }
        return permission in permissions.get(self.role, [])
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None
        }
    
    def __repr__(self):
        return f'<User {self.username}>'


class Verification(db.Model):
    __tablename__ = 'verifications'
    
    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False)
    member_number = db.Column(db.String(50), nullable=False)
    member_name = db.Column(db.String(200), nullable=False)
    zone = db.Column(db.String(100), nullable=False)
    id_number = db.Column(db.String(50), nullable=False)
    verified_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'member_id': self.member_id,
            'member_number': self.member_number,
            'member_name': self.member_name,
            'zone': self.zone,
            'id_number': self.id_number,
            'verified_at': self.verified_at.isoformat() if self.verified_at else None
        }
    
    def __repr__(self):
        return f'<Verification {self.member_number} at {self.verified_at}>'


class CorrectionRequest(db.Model):
    __tablename__ = 'correction_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False)
    member_number = db.Column(db.String(50), nullable=False)
    id_number = db.Column(db.String(50), nullable=False)
    
    # Current information
    current_name = db.Column(db.String(200), nullable=False)
    current_zone = db.Column(db.String(100), nullable=False)
    current_status = db.Column(db.String(20), nullable=False)
    
    # Corrected information
    correct_name = db.Column(db.String(200), nullable=False)
    correct_zone = db.Column(db.String(100), nullable=False)
    
    # Contact information
    email = db.Column(db.String(120))
    phone = db.Column(db.String(20))
    additional_notes = db.Column(db.Text)
    
    # Status tracking
    status = db.Column(db.String(20), default='pending')
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    resolved_at = db.Column(db.DateTime)
    resolved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'member_id': self.member_id,
            'member_number': self.member_number,
            'id_number': self.id_number,
            'current_name': self.current_name,
            'current_zone': self.current_zone,
            'current_status': self.current_status,
            'correct_name': self.correct_name,
            'correct_zone': self.correct_zone,
            'email': self.email,
            'phone': self.phone,
            'additional_notes': self.additional_notes,
            'status': self.status,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None
        }
    
    def __repr__(self):
        return f'<CorrectionRequest {self.member_number} - {self.status}>'


# NEW: Search Log model to track all searches
class SearchLog(db.Model):
    __tablename__ = 'search_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=True)
    member_number = db.Column(db.String(50), nullable=False, index=True)
    id_number = db.Column(db.String(50), nullable=False)
    search_successful = db.Column(db.Boolean, default=False)
    ip_address = db.Column(db.String(45))  # IPv6 compatible
    user_agent = db.Column(db.String(500))
    searched_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'member_id': self.member_id,
            'member_number': self.member_number,
            'id_number': self.id_number,
            'search_successful': self.search_successful,
            'ip_address': self.ip_address,
            'searched_at': self.searched_at.isoformat() if self.searched_at else None
        }
    
    def __repr__(self):
        return f'<SearchLog {self.member_number} - {"Success" if self.search_successful else "Failed"}>'