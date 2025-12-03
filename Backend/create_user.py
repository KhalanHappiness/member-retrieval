"""
Script to create admin users for the SACCO system
Run this script from the backend directory: python create_user.py
"""

from app import app, db
from models import User

def create_user():
    print("\n=== SACCO Admin User Creation ===\n")
    
    username = input("Enter username: ").strip()
    if not username:
        print("Username cannot be empty!")
        return
    
    # Check if user exists
    existing = User.query.filter_by(username=username).first()
    if existing:
        print(f"User '{username}' already exists!")
        return
    
    email = input("Enter email: ").strip()
    if not email:
        print("Email cannot be empty!")
        return
    
    password = input("Enter password: ").strip()
    if not password:
        print("Password cannot be empty!")
        return
    
    confirm_password = input("Confirm password: ").strip()
    if password != confirm_password:
        print("Passwords do not match!")
        return
    
    role = input("Enter role (default: admin): ").strip() or 'admin'
    
    # Create user
    new_user = User(
        username=username,
        email=email,
        role=role
    )
    new_user.set_password(password)
    
    try:
        db.session.add(new_user)
        db.session.commit()
        print(f"\n✅ User '{username}' created successfully!")
        print(f"   Email: {email}")
        print(f"   Role: {role}")
    except Exception as e:
        db.session.rollback()
        print(f"\n❌ Error creating user: {str(e)}")

def list_users():
    print("\n=== Current Admin Users ===\n")
    users = User.query.all()
    
    if not users:
        print("No users found.")
        return
    
    for user in users:
        status = "Active" if user.is_active else "Inactive"
        last_login = user.last_login.strftime("%Y-%m-%d %H:%M") if user.last_login else "Never"
        print(f"• {user.username} ({user.email}) - {user.role} - {status} - Last login: {last_login}")

def change_password():
    print("\n=== Change User Password ===\n")
    
    username = input("Enter username: ").strip()
    user = User.query.filter_by(username=username).first()
    
    if not user:
        print(f"User '{username}' not found!")
        return
    
    new_password = input("Enter new password: ").strip()
    confirm_password = input("Confirm new password: ").strip()
    
    if new_password != confirm_password:
        print("Passwords do not match!")
        return
    
    user.set_password(new_password)
    db.session.commit()
    print(f"\n✅ Password changed successfully for user '{username}'!")

def main():
    with app.app_context():
        while True:
            print("\n" + "="*40)
            print("SACCO User Management")
            print("="*40)
            print("1. Create new admin user")
            print("2. List all users")
            print("3. Change user password")
            print("4. Exit")
            print("="*40)
            
            choice = input("\nEnter your choice (1-4): ").strip()
            
            if choice == '1':
                create_user()
            elif choice == '2':
                list_users()
            elif choice == '3':
                change_password()
            elif choice == '4':
                print("\nGoodbye!")
                break
            else:
                print("Invalid choice. Please try again.")

if __name__ == '__main__':
    main()