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

## 9) How user data is extracted currently (use this pattern)

The frontend currently extracts authenticated user data through `AuthService`:
- token source: localStorage key `authToken`
- user source: localStorage key `authUser`
- in-memory reactive source: `currentUser$` (BehaviorSubject)

Current user shape:

```ts
interface AuthUser {
  userId: number;
  username: string;
  email: string;
  role: BackendRole;
}
```

Helper methods already available in `AuthService`:
- `getCurrentUser()`
- `getCurrentUserId()`
- `getCurrentRole()`
- `hasRole(...)`
- `hasAnyRole(...)`
- `currentUser$` for reactive subscriptions

Use this placeholder in your component/service when you need the logged-in user id:

```ts
// TEAM PLACEHOLDER: replace <feature> with your domain service
constructor(
  private authService: AuthService,
  private <feature>Service: <Feature>Service
) {}

ngOnInit(): void {
  const currentUserId = this.authService.getCurrentUserId();
  if (currentUserId == null) {
    return;
  }

  this.<feature>Service.loadForUser(currentUserId).subscribe();
}
```

Reactive example (recommended when navbar/profile data must update live):

```ts
this.authService.currentUser$.subscribe((user) => {
  this.currentUser = user;
  this.currentUserRole = user?.role ?? null;
  this.currentUserId = user?.userId ?? null;
});
```

Important rule:
- Do not read role/userId from random localStorage keys in feature code.
- Always use `AuthService` helpers so all teams stay consistent.

## 10) Delivery module integration

The `delivery` module has been copied from `AgricultureFront-moduleLivraison` into this project.

Summary:
- Root route: `/delivery`
- Loading: lazy-loaded `DeliveryModule`
- Access: protected with `AuthGuard`
- API base: `/livraison/api/livraisons`
- Global map styles: `Leaflet` is imported in `src/styles.css`
- Dev proxy: `proxy.conf.json` handles `/livraison` and `/osrm`

Added or synchronized files:
- `src/app/delivery/**`
- `src/environments/environment.ts`
- `src/environments/environment.example.ts`
- `proxy.conf.json`
- `karma.conf.cjs`
- `tsconfig.spec.json`
- `src/test.ts`

Checklist:
1. Install the new dependencies from `package.json`.
2. Use `npm start` so the proxy is active during development.
3. Verify JWT headers are attached to delivery API calls.
4. Fill `src/environments/environment.ts` with a local Groq key only if the chatbot feature is needed.
5. Run `npm run test:sim` to execute the delivery simulation specs if required.

