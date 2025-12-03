from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///sacco_members.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Member model
class Member(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    member_number = db.Column(db.String(50), unique=True, nullable=False)
    id_number = db.Column(db.String(50), nullable=False)
    zone = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'member_number': self.member_number,
            'id_number': self.id_number,
            'zone': self.zone,
            'created_at': self.created_at.isoformat()
        }

# Create tables
with app.app_context():
    db.create_all()

# Admin Routes
@app.route('/admin/members', methods=['GET'])
def get_all_members():
    members = Member.query.all()
    return jsonify([member.to_dict() for member in members])

@app.route('/admin/members', methods=['POST'])
def add_member():
    data = request.json
    
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
    
    db.session.add(new_member)
    db.session.commit()
    
    return jsonify(new_member.to_dict()), 201

@app.route('/admin/members/<int:member_id>', methods=['DELETE'])
def delete_member(member_id):
    member = Member.query.get_or_404(member_id)
    db.session.delete(member)
    db.session.commit()
    return jsonify({'message': 'Member deleted successfully'})

@app.route('/admin/members/<int:member_id>', methods=['PUT'])
def update_member(member_id):
    member = Member.query.get_or_404(member_id)
    data = request.json
    
    member.name = data.get('name', member.name)
    member.member_number = data.get('member_number', member.member_number)
    member.id_number = data.get('id_number', member.id_number)
    member.zone = data.get('zone', member.zone)
    
    db.session.commit()
    return jsonify(member.to_dict())

# Public Search Route
@app.route('/search', methods=['POST'])
def search_member():
    data = request.json
    member_number = data.get('member_number', '').strip()
    id_number = data.get('id_number', '').strip()
    
    if not member_number or not id_number:
        return jsonify({'error': 'Both member number and ID number are required'}), 400
    
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

if __name__ == '__main__':
    app.run(debug=True, port=5000)