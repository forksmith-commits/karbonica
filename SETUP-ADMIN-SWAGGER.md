# Setup Admin Panel & Swagger Documentation

## What I've Created:

✅ **Swagger API Documentation** - Interactive API docs at `/api-docs`
✅ **Admin User Management API** - CRUD operations for users
✅ **Delete users by ID or email**
✅ **List all users with pagination**
✅ **Full OpenAPI 3.0 specification**

## Installation Steps:

### Step 1: Stop your server
Press `Ctrl+C` in the terminal where `npm run dev` is running

### Step 2: Install packages
```bash
npm install swagger-ui-express swagger-jsdoc
npm install --save-dev @types/swagger-ui-express @types/swagger-jsdoc
```

### Step 3: Restart server
```bash
npm run dev
```

## Access Points:

### 1. Swagger API Documentation
**URL:** http://localhost:3000/api-docs

Features:
- Interactive API testing
- Try out endpoints directly in browser
- See all request/response schemas
- Authentication support
- Beautiful UI

### 2. Admin API Endpoints

#### List All Users
**GET** `http://localhost:3000/api/v1/admin/users`

Query parameters:
- `page` (default: 1)
- `limit` (default: 20)

Example:
```
GET http://localhost:3000/api/v1/admin/users?page=1&limit=10
```

#### Get User by ID
**GET** `http://localhost:3000/api/v1/admin/users/{userId}`

Example:
```
GET http://localhost:3000/api/v1/admin/users/550e8400-e29b-41d4-a716-446655440000
```

#### Delete User by ID
**DELETE** `http://localhost:3000/api/v1/admin/users/{userId}`

Example:
```
DELETE http://localhost:3000/api/v1/admin/users/550e8400-e29b-41d4-a716-446655440000
```

#### Delete User by Email
**DELETE** `http://localhost:3000/api/v1/admin/users/email/{email}`

Example:
```
DELETE http://localhost:3000/api/v1/admin/users/email/test@example.com
```

## Quick Test in Postman:

### Delete a Test User:
1. **DELETE** `http://localhost:3000/api/v1/admin/users/email/test@example.com`
2. You'll get:
```json
{
  "status": "success",
  "data": {
    "message": "User deleted successfully",
    "deletedUserId": "550e8400-e29b-41d4-a716-446655440000",
    "deletedEmail": "test@example.com"
  }
}
```

### List All Users:
1. **GET** `http://localhost:3000/api/v1/admin/users`
2. You'll see all users with pagination

## Using Swagger UI:

1. Go to: http://localhost:3000/api-docs
2. You'll see all your API endpoints organized by tags:
   - **Authentication** - Register, verify email
   - **Admin** - User management
   - **Health** - Health checks

3. Click on any endpoint to expand it
4. Click "Try it out" button
5. Fill in parameters
6. Click "Execute"
7. See the response!

## Features Implemented:

### Admin User Management:
- ✅ List all users (with pagination)
- ✅ Get user by ID
- ✅ Delete user by ID
- ✅ Delete user by email
- ✅ User count
- ✅ Exclude password hashes from responses

### Swagger Documentation:
- ✅ OpenAPI 3.0 specification
- ✅ Interactive UI
- ✅ Request/response schemas
- ✅ Authentication documentation
- ✅ Error response schemas
- ✅ Tags and organization

## Next Steps (Optional):

### Add Authentication to Admin Routes:
Currently admin routes are open. To secure them:

1. Implement JWT authentication
2. Add middleware to check for admin role
3. Protect admin routes

### Add More Admin Features:
- Bulk delete users
- Update user details
- Reset user passwords
- View user activity logs
- Manage projects
- Manage verification requests

### Create Admin UI:
- Build a React/Vue admin dashboard
- Connect to admin API endpoints
- Add data tables, charts, etc.

## Files Created:

- `src/config/swagger.ts` - Swagger configuration
- `src/routes/admin/users.ts` - Admin user management routes
- Updated `src/index.ts` - Added Swagger and admin routes
- Updated `src/infrastructure/repositories/UserRepository.ts` - Added findAll and count methods
- Updated `src/routes/auth.ts` - Added Swagger documentation

## Troubleshooting:

### Issue: "Cannot find module 'swagger-ui-express'"
**Solution:** Make sure you stopped the server before installing packages

### Issue: Swagger UI not loading
**Solution:** 
1. Check server is running
2. Visit http://localhost:3000/api-docs
3. Check console for errors

### Issue: Admin routes returning errors
**Solution:** Make sure migrations are applied and database is connected

## Summary:

You now have:
1. ✅ **Swagger API Docs** at `/api-docs` - Test all endpoints interactively
2. ✅ **Admin API** at `/api/v1/admin/users` - Manage users programmatically
3. ✅ **Delete users** by ID or email
4. ✅ **List users** with pagination
5. ✅ **Full API documentation** with schemas

Just install the packages and restart your server! 🚀
