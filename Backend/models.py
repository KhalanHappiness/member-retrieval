from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Member(db.Model):
    __tablename__ = 'members'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    member_number = db.Column(db.String(50), unique=True, nullable=False)
    id_number = db.Column(db.String(50), nullable=False)
    zone = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<Member {self.name} - {self.member_number}>'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'member_number': self.member_number,
            'id_number': self.id_number,
            'zone': self.zone,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }