# Deploy
- S3 Backups
- Migration from supabase to postgres
- Migration from vercel to vps
- 


## Authentication / Authorization
- Rate Limiting for all routes and more restrictive for sensitive routes
 - Verify for 429 status codes
 - Choose reasonable number of requests per minute for each route
 - public routes on frontend should be rate limited to avoid abuse

## Infra
- Database port
- Backend ports
- Backung running
 - Create a backup service to AWS S3
