# Deployment Guide

This guide provides detailed instructions for deploying the Task Scheduler application in different environments.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Production Deployment](#production-deployment)
4. [Staging Deployment](#staging-deployment)
5. [Infrastructure Setup](#infrastructure-setup)
6. [Monitoring & Logging](#monitoring--logging)
7. [Backup & Recovery](#backup--recovery)
8. [SSL/TLS Configuration](#ssltls-configuration)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software
- Docker (20.10.x or later)
- Docker Compose (2.x)
- PostgreSQL (14.x)
- Redis (6.x)
- Nginx (1.20.x)
- Node.js (18.x) for frontend builds

### Required Access
- Docker registry access
- Production server SSH access
- SSL certificates
- Database backup location access
- Cloud provider credentials

## Environment Configuration

### Production Environment Variables
```env
# Application
HOST=0.0.0.0
PORT=8080
RUST_LOG=info
ENVIRONMENT=production

# Database
DATABASE_URL=postgres://user:password@db:5432/task_scheduler
DB_POOL_SIZE=10

# Authentication
JWT_SECRET=your-secure-secret
JWT_EXPIRATION=15m
REFRESH_TOKEN_EXPIRATION=7d

# Email
SMTP_HOST=smtp.provider.com
SMTP_PORT=587
SMTP_USERNAME=your-username
SMTP_PASSWORD=your-secure-password

# Storage
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-key

# Redis
REDIS_URL=redis://:password@redis:6379

# Monitoring
PROMETHEUS_METRICS=true
```

## Production Deployment

### 1. Prepare for Deployment
```bash
# Clone repository
git clone https://github.com/organization/task-scheduler.git
cd task-scheduler

# Build production images
docker-compose -f deploy/production.yml build
```

### 2. Initial Setup
```bash
# Create required directories
mkdir -p /opt/task-scheduler/{data,logs,ssl}
mkdir -p /opt/task-scheduler/nginx/{conf.d,logs,ssl}

# Copy configuration files
cp deploy/production.yml /opt/task-scheduler/
cp deploy/nginx/conf.d/* /opt/task-scheduler/nginx/conf.d/
cp deploy/monitoring/* /opt/task-scheduler/monitoring/

# Set up SSL certificates
certbot certonly --nginx -d taskscheduler.com
```

### 3. Database Setup
```bash
# Initial database setup
docker-compose -f deploy/production.yml run --rm app sea-orm-cli migrate up

# Verify database connection
docker-compose -f deploy/production.yml run --rm app sea-orm-cli database ping
```

### 4. Start Services
```bash
cd /opt/task-scheduler

# Start all services
docker-compose -f production.yml up -d

# Verify services
docker-compose -f production.yml ps
```

## Staging Deployment

Similar to production but with different environment variables and domain names.

### Staging-Specific Configuration
```bash
# Use staging configuration
cp deploy/staging.yml /opt/task-scheduler-staging/
```

## Infrastructure Setup

### Load Balancer Configuration
```nginx
upstream backend {
    server app1:8080;
    server app2:8080;
    keepalive 32;
}
```

### High Availability Setup
- Configure master-slave replication for PostgreSQL
- Set up Redis cluster
- Use container orchestration (e.g., Kubernetes)

## Monitoring & Logging

### Setup Monitoring Stack
```bash
# Start monitoring services
docker-compose -f monitoring.yml up -d

# Access monitoring dashboards
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3000
```

### Log Aggregation
```bash
# Configure log drivers
docker-compose -f production.yml logs -f --tail=100
```

## Backup & Recovery

### Database Backups
```bash
# Manual backup
docker-compose -f production.yml exec db pg_dump -U postgres > backup.sql

# Automated backup script
0 0 * * * /opt/task-scheduler/scripts/backup.sh
```

### Recovery Procedure
1. Stop application services
2. Restore database from backup
3. Verify data integrity
4. Restart services

## SSL/TLS Configuration

### Certificate Installation
```bash
# Install certificates
certbot certonly --nginx -d taskscheduler.com

# Configure Nginx
cp ssl/fullchain.pem /opt/task-scheduler/nginx/ssl/
cp ssl/privkey.pem /opt/task-scheduler/nginx/ssl/
```

### SSL Renewal
```bash
# Automatic renewal
0 0 1 * * certbot renew
```

## Scaling

### Horizontal Scaling
```bash
# Scale application instances
docker-compose -f production.yml up -d --scale app=3

# Update load balancer configuration
vim /opt/task-scheduler/nginx/conf.d/default.conf
```

### Database Scaling
1. Set up read replicas
2. Configure connection pooling
3. Implement caching strategy

## Health Checks

### Application Health
```bash
# Check application health
curl http://localhost:8080/health

# Monitor service health
docker-compose -f production.yml ps
```

### Database Health
```bash
# Check database connectivity
docker-compose -f production.yml exec db pg_isready
```

## Rollback Procedure

1. **Quick Rollback**
```bash
# Rollback to previous version
docker-compose -f production.yml down
docker image tag task-scheduler:previous task-scheduler:latest
docker-compose -f production.yml up -d
```

2. **Database Rollback**
```bash
# Rollback migration
sea-orm-cli migrate down
```

## Troubleshooting

### Common Issues

1. **Service Won't Start**
```bash
# Check logs
docker-compose -f production.yml logs app

# Verify environment variables
docker-compose -f production.yml config
```

2. **Database Connection Issues**
```bash
# Check database status
docker-compose -f production.yml exec db pg_isready

# Verify network connectivity
docker-compose -f production.yml exec app ping db
```

3. **Memory Issues**
```bash
# Check memory usage
docker stats

# Adjust resource limits in production.yml
```

### Performance Optimization

1. **Cache Configuration**
```bash
# Configure Redis cache
vim /opt/task-scheduler/redis/redis.conf

# Restart Redis
docker-compose -f production.yml restart redis
```

2. **Database Optimization**
```bash
# Optimize PostgreSQL configuration
vim /opt/task-scheduler/postgres/postgresql.conf

# Apply changes
docker-compose -f production.yml restart db
```

## Security Considerations

1. **Firewall Configuration**
```bash
# Configure UFW
ufw allow 80,443/tcp
ufw allow from 10.0.0.0/8 to any port 5432 proto tcp
```

2. **Regular Updates**
```bash
# Update containers
docker-compose -f production.yml pull
docker-compose -f production.yml up -d
```

## Support

For deployment issues:
1. Check logs and monitoring dashboards
2. Review documentation
3. Contact DevOps team
4. Open support ticket

Emergency contacts:
- DevOps: devops@taskscheduler.com
- Security: security@taskscheduler.com
- Support: support@taskscheduler.com
