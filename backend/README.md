# Backend (Phase 1 + Early Phase 2)

## Implemented
- Auth bootstrap/login with JWT + bcrypt
- Category CRUD (soft delete)
- Product CRUD (soft delete)
- Low-stock filtering support (`?lowStock=true`)
- Manual stock editing disabled via product update endpoint

## Run
1. Copy `.env.example` to `.env`
2. Update environment values
3. Start API:

```bash
npm run dev
```

Base URL: `http://localhost:5000`
