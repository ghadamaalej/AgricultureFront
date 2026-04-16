# Integration Guide


Reference implementation: the existing forums feature (already working with gateway + JWT interceptor).

## 1) How JWT interception works in this project

The app uses a global HTTP interceptor:
- File: src/app/services/auth/auth-token.interceptor.ts
- Registered in: src/app/app.module.ts

The interceptor reads token from localStorage key `authToken` and adds:
- `Authorization: Bearer <token>`

It only injects the token for requests whose URL matches one of these patterns:
- starts with `http://localhost:8089/`
- starts with `/forums/`
- starts with `/user/`

Important rule:
- If your service uses a different URL base that does not match those patterns, no JWT header will be sent.

Use the following placeholder snippet to know exactly where to update prefixes when your team adds a new service:

```ts
const isApiRequest = req.url.startsWith('http://localhost:8089/')
  || req.url.startsWith('/forums/')
  || req.url.startsWith('/user/')
  // TEAM PLACEHOLDER: add your service prefix below.
  // Replace <your-service-prefix> with the gateway route prefix used by your backend route.
  // Example: /inventory/, /events/, /marketplace/
  || req.url.startsWith('/<your-service-prefix>/');
```

Example for a team owning inventory endpoints:

```ts
const isApiRequest = req.url.startsWith('http://localhost:8089/')
  || req.url.startsWith('/forums/')
  || req.url.startsWith('/user/')
  || req.url.startsWith('/inventory/');
```

Keep this part unchanged unless your auth storage changes:

```ts
const token = localStorage.getItem('authToken');

const authReq = req.clone({
  setHeaders: {
    Authorization: `Bearer ${token}`
  }
});
```

## 2) API URL convention to follow (same as forums)

Use gateway URLs so auth is centralized and interception works.

Working forums example:
- `http://localhost:8089/forums/api/forums/...`

Auth service example:
- `http://localhost:8089/user/api/auth/...`

For a new microservice, keep this shape:
- `http://localhost:8089/<service-prefix>/api/<controller-prefix>/...`

## 3) Add your routes in app routing (placeholders already provided)

Update:
- src/app/app-routing.module.ts

The file already contains placeholders you should replace when your pages/modules are ready:

```ts
// TODO: Replace each role-home placeholder route with its dedicated module/page when implemented.
{ path: 'buyer/home', component: RoleHomePlaceholderComponent, canActivate: [AuthGuard], data: { roles: ['ACHETEUR'], homeLabel: 'buyer home' } },
{ path: 'farmer/home', component: RoleHomePlaceholderComponent, canActivate: [AuthGuard], data: { roles: ['AGRICULTEUR'], homeLabel: 'farmer home' } },
{ path: 'expert/home', component: RoleHomePlaceholderComponent, canActivate: [AuthGuard], data: { roles: ['EXPERT_AGRICOLE'], homeLabel: 'agricultural expert home' } },
{ path: 'transporter/home', component: RoleHomePlaceholderComponent, canActivate: [AuthGuard], data: { roles: ['TRANSPORTEUR'], homeLabel: 'transporter home' } },
{ path: 'veterinarian/home', component: RoleHomePlaceholderComponent, canActivate: [AuthGuard], data: { roles: ['VETERINAIRE'], homeLabel: 'veterinarian home' } },
{ path: 'agent/home', component: RoleHomePlaceholderComponent, canActivate: [AuthGuard], data: { roles: ['AGENT'], homeLabel: 'agent home' } },
{ path: 'organizer/home', component: RoleHomePlaceholderComponent, canActivate: [AuthGuard], data: { roles: ['ORGANISATEUR_EVENEMENT'], homeLabel: 'event organizer home' } },
```

Replace each placeholder route with your real component or lazy-loaded module.

Example (lazy-loaded module):

```ts
{
  path: 'buyer/home',
  loadChildren: () => import('./buyer/buyer.module').then(m => m.BuyerModule),
  canActivate: [AuthGuard],
  data: { roles: ['ACHETEUR'] }
}
```

## 4) Service template your team can copy

Use HttpClient + gateway URL + typed interfaces.

```ts
@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly apiUrl = 'http://localhost:8089/inventory/api/inventory';

  constructor(private http: HttpClient) {}

  getItems(): Observable<ItemDto[]> {
    return this.http.get<ItemDto[]>(`${this.apiUrl}/items`);
  }

  createItem(payload: CreateItemRequest): Observable<ItemDto> {
    return this.http.post<ItemDto>(`${this.apiUrl}/items`, payload);
  }
}
```

Because URL starts with `http://localhost:8089/`, JWT is attached automatically.

## 5) Route guards and role-based access

Current app already uses:
- AuthGuard for protected routes
- GuestGuard for login page

When adding feature routes:
- add `canActivate: [AuthGuard]` for protected pages
- add `data: { roles: [...] }` when role restriction is needed

## 6) Auth storage contract (do not break)

Current auth flow expects:
- token in localStorage key: `authToken`
- user in localStorage key: `authUser`

If your login flow changes these keys, interceptor + guards will break.

## 7) Integration checklist for each team

1. Add gateway route in backend gateway for your service prefix (for example `/inventory/**`).
2. Use Angular service base URL through gateway (`http://localhost:8089/<prefix>/...`).
3. Add your module/component route in `app-routing.module.ts` by replacing placeholder.
4. Protect route with `AuthGuard` and role data when needed.
5. Verify request in browser devtools contains `Authorization: Bearer ...`.
6. Verify endpoint works through gateway (not only direct microservice port).

## 8) Quick troubleshooting

If endpoint works in Postman but fails in Angular:
- Check URL matches interceptor patterns.
- Check `authToken` exists in localStorage.
- Check request is going through gateway port 8089.
- Check gateway has route for your service prefix.

If you get 404 from gateway:
- verify service is registered in Eureka
- verify gateway route prefix + StripPrefix settings
- restart gateway + target service to avoid stale instance registration

---

If needed, we can later split this into per-team pages (Buyer/Farmer/Expert/etc.) with exact route and service stubs for each role.
