# Security Documentation

This document outlines the security measures and best practices implemented in the Task Scheduler API.

## Authentication

### JWT-based Authentication

The system uses JSON Web Tokens (JWT) for authentication with a two-token system:
1. Access Token (short-lived, 15 minutes)
2. Refresh Token (long-lived, 7 days)

#### Token Structure
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user-uuid",
    "email": "user@example.com",
    "role": "MEMBER",
    "exp": 1582142400
  }
}
```

### Password Security
- Passwords are hashed using bcrypt with a cost factor of 12
- Minimum password requirements:
  - At least 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character
- Password history maintained to prevent reuse
- Automatic account lockout after 5 failed attempts
- Passwords must be changed every 90 days

### Session Management
- Access tokens are short-lived (15 minutes)
- Refresh tokens are invalidated on logout
- Multiple devices supported with device tracking
- Session termination available for all devices

## Authorization

### Role-Based Access Control (RBAC)

#### User Roles
1. **Admin**
   - Full system access
   - User management
   - System configuration

2. **Manager**
   - Project creation
   - User assignment
   - Resource management

3. **Member**
   - Task execution
   - Comment creation
   - File uploads

#### Permission Matrix

| Action                  | Admin | Manager | Member |
|------------------------|-------|---------|---------|
| Create Project         | ✓     | ✓       | ✗       |
| Delete Project         | ✓     | ✗       | ✗       |
| Manage Project Members | ✓     | ✓       | ✗       |
| Create Task            | ✓     | ✓       | ✓       |
| Delete Task            | ✓     | ✓       | ✗       |
| Assign Task            | ✓     | ✓       | ✗       |
| Comment                | ✓     | ✓       | ✓       |
| Upload Files           | ✓     | ✓       | ✓       |
| View Reports           | ✓     | ✓       | ✗       |

### Project-Level Access Control
- Project-specific roles (Owner, Editor, Viewer)
- Inherited permissions from user roles
- Resource isolation between projects

## Data Security

### Encryption
- All data in transit encrypted using TLS 1.3
- Sensitive data at rest encrypted using AES-256
- Database encryption for sensitive columns
- File encryption for stored attachments

### API Security
- HTTPS-only communication
- CORS configuration with whitelisted origins
- Rate limiting per user and IP
- Request size limits
- Input validation and sanitization

### File Upload Security
- File type validation
- File size limits (max 10MB)
- Virus scanning
- Secure file storage with Supabase
- Content-Type verification

## Audit Trail
- All security-relevant events logged
- User actions tracked with timestamps
- IP address and device information recorded
- Audit logs encrypted and retained for 1 year

## Security Headers
```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

## Error Handling
- Generic error messages to users
- Detailed logging for debugging
- No sensitive data in error responses
- Structured error format

## Compliance
- GDPR compliance measures
- Data retention policies
- User consent management
- Right to be forgotten implementation

## Security Best Practices
1. Regular security updates
2. Dependency vulnerability scanning
3. Regular penetration testing
4. Security incident response plan
5. Employee security training
6. Code review requirements
7. Secure development lifecycle

## Monitoring and Alerts
- Real-time security monitoring
- Suspicious activity detection
- Failed login attempt alerts
- Resource usage monitoring
- Uptime monitoring

## Backup and Recovery
- Regular database backups
- Encrypted backup storage
- Tested recovery procedures
- Geographic redundancy

## Contact
For security concerns or to report vulnerabilities:
- Email: security@taskscheduler.com
- Bug Bounty Program: https://bugbounty.taskscheduler.com
