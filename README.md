# Construction Management System - Backend

Backend API server for the Construction Management System built with Node.js, Express, and MongoDB.

## 🚀 Live Deployment

- **Production URL**: https://construction-management-system-soft.vercel.app/

## 📋 Features

- **Authentication System**
  - JWT-based authentication
  - Secure password hashing with bcryptjs
  - Protected routes with middleware
- **User Management**
  - Role-based access control (Admin, Manager, Accountant, User)
  - User CRUD operations
  - Status management (Active/Inactive)
- **Double-Entry Accounting System**
  - Automatic journal entry creation from transactions
  - General ledger with running balances
  - Trial balance verification
  - Balance sheet (Assets = Liabilities + Equity)
  - Profit & Loss statement
  - Complete audit trail
- **Inventory Management**
  - Item master with stock tracking
  - Purchase increases stock
  - Sales decreases stock
  - Prevents overselling
- **Financial Management**
  - Chart of Accounts with 5 account types
  - Customer & Supplier ledgers
  - Project-based accounting
  - Bank payment tracking
  - Cash payment tracking
- **Reporting**
  - Customer ledger
  - Supplier ledger
  - Project profitability
  - Inventory report
  - Income statement
- **Security**
  - CORS configuration
  - JWT token validation
  - Permission-based route protection
  - Environment variable protection

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js v5.1.0
- **Database**: MongoDB with Mongoose v9.0.0
- **Authentication**: JWT (jsonwebtoken v9.0.2)
- **Password Hashing**: bcryptjs v3.0.3
- **Environment Variables**: dotenv v17.2.3
- **CORS**: cors v2.8.5

## 📁 Project Structure

```
server/
├── controllers/
│   ├── authController.js              # Authentication logic
│   ├── userController.js              # User management
│   ├── journalEntryController.js      # Journal entry operations
│   ├── generalLedgerController.js     # Ledger & financial statements
│   ├── accountTypeController.js       # Account type management
│   ├── chartOfAccountController.js    # Chart of accounts
│   ├── customerController.js          # Customer management
│   ├── supplierController.js          # Supplier management
│   ├── projectController.js           # Project management
│   ├── itemController.js              # Item/inventory management
│   ├── purchaseController.js          # Purchase transactions
│   ├── salesInvoiceController.js      # Sales transactions
│   ├── bankPaymentController.js       # Payment tracking
│   ├── reportController.js            # Report generation
│   └── dashboardController.js         # Dashboard statistics
├── services/
│   └── accountingService.js           # Accounting business logic
├── db/
│   └── db.js                          # MongoDB connection
├── middleware/
│   ├── authMiddleware.js              # JWT verification & authorization
│   └── dbConnection.js                # Database connection middleware
├── models/
│   ├── User.js                        # User schema
│   ├── JournalEntry.js                # Journal entry with double-entry validation
│   ├── GeneralLedger.js               # General ledger with running balances
│   ├── AccountType.js                 # Account type schema
│   ├── ChartOfAccount.js              # Chart of accounts
│   ├── Customer.js                    # Customer schema
│   ├── Supplier.js                    # Supplier schema
│   ├── Project.js                     # Project schema
│   ├── Item.js                        # Item/inventory schema
│   ├── Purchase.js                    # Purchase transaction (auto-creates journal entry)
│   ├── SalesInvoice.js                # Sales transaction (auto-creates journal entry)
│   └── BankPayment.js                 # Payment transaction (auto-creates journal entry)
├── routes/
│   ├── authRoutes.js                  # Auth endpoints
│   ├── userRoutes.js                  # User endpoints
│   ├── journalEntryRoutes.js          # Journal entry endpoints
│   ├── generalLedgerRoutes.js         # Ledger endpoints
│   ├── accountTypeRoutes.js           # Account type endpoints
│   ├── chartOfAccountRoutes.js        # Chart of accounts endpoints
│   ├── customerRoutes.js              # Customer endpoints
│   ├── supplierRoutes.js              # Supplier endpoints
│   ├── projectRoutes.js               # Project endpoints
│   ├── itemRoutes.js                  # Item endpoints
│   ├── purchaseRoutes.js              # Purchase endpoints
│   ├── salesInvoiceRoutes.js          # Sales endpoints
│   ├── bankPaymentRoutes.js           # Payment endpoints
│   ├── reportRoutes.js                # Report endpoints
│   └── dashboardRoutes.js             # Dashboard endpoints
├── .gitignore
├── index.js                           # Server entry point
├── vercel.json                        # Vercel deployment config
└── package.json
```

## 🔧 Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd server
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
NODE_ENV=development
```

4. Start the development server:

```bash
npm run dev
```

## 📡 API Endpoints

### Authentication Routes (`/api/auth`)

| Method | Endpoint          | Description      | Access  |
| ------ | ----------------- | ---------------- | ------- |
| POST   | `/api/auth/login` | User login       | Public  |
| GET    | `/api/auth/me`    | Get current user | Private |

### User Routes (`/api/users`)

| Method | Endpoint                       | Description        | Access |
| ------ | ------------------------------ | ------------------ | ------ |
| GET    | `/api/users`                   | Get all users      | Admin  |
| GET    | `/api/users/:id`               | Get user by ID     | Admin  |
| POST   | `/api/users`                   | Create new user    | Admin  |
| PUT    | `/api/users/:id`               | Update user        | Admin  |
| DELETE | `/api/users/:id`               | Delete user        | Admin  |
| PATCH  | `/api/users/:id/toggle-status` | Toggle user status | Admin  |

### Journal Entry Routes (`/api/journal-entries`)

| Method | Endpoint                           | Description                  | Access     |
| ------ | ---------------------------------- | ---------------------------- | ---------- |
| GET    | `/api/journal-entries`             | Get all journal entries      | Accounting |
| GET    | `/api/journal-entries/:id`         | Get journal entry by ID      | Accounting |
| POST   | `/api/journal-entries`             | Create manual journal entry  | Accounting |
| PUT    | `/api/journal-entries/:id`         | Update journal entry         | Accounting |
| DELETE | `/api/journal-entries/:id`         | Delete journal entry         | Accounting |
| POST   | `/api/journal-entries/:id/reverse` | Reverse a journal entry      | Accounting |
| POST   | `/api/journal-entries/:id/post`    | Post entry to general ledger | Accounting |

### General Ledger Routes (`/api/general-ledger`)

| Method | Endpoint                            | Description                 | Access     |
| ------ | ----------------------------------- | --------------------------- | ---------- |
| GET    | `/api/general-ledger`               | Get all ledger entries      | Accounting |
| GET    | `/api/general-ledger/account/:id`   | Get entries by account      | Accounting |
| GET    | `/api/general-ledger/project/:id`   | Get entries by project      | Accounting |
| GET    | `/api/general-ledger/trial-balance` | Get trial balance           | Accounting |
| GET    | `/api/general-ledger/balance-sheet` | Get balance sheet           | Accounting |
| GET    | `/api/general-ledger/profit-loss`   | Get profit & loss statement | Accounting |

### Account Type Routes (`/api/account-types`)

| Method | Endpoint                 | Description            | Access |
| ------ | ------------------------ | ---------------------- | ------ |
| GET    | `/api/account-types`     | Get all account types  | Admin  |
| GET    | `/api/account-types/:id` | Get account type by ID | Admin  |
| POST   | `/api/account-types`     | Create account type    | Admin  |
| PUT    | `/api/account-types/:id` | Update account type    | Admin  |
| DELETE | `/api/account-types/:id` | Delete account type    | Admin  |

### Chart of Account Routes (`/api/chart-of-accounts`)

| Method | Endpoint                     | Description        | Access     |
| ------ | ---------------------------- | ------------------ | ---------- |
| GET    | `/api/chart-of-accounts`     | Get all accounts   | Accounting |
| GET    | `/api/chart-of-accounts/:id` | Get account by ID  | Accounting |
| POST   | `/api/chart-of-accounts`     | Create new account | Accounting |
| PUT    | `/api/chart-of-accounts/:id` | Update account     | Accounting |
| DELETE | `/api/chart-of-accounts/:id` | Delete account     | Accounting |

### Customer Routes (`/api/customers`)

| Method | Endpoint             | Description         | Access |
| ------ | -------------------- | ------------------- | ------ |
| GET    | `/api/customers`     | Get all customers   | User   |
| GET    | `/api/customers/:id` | Get customer by ID  | User   |
| POST   | `/api/customers`     | Create new customer | User   |
| PUT    | `/api/customers/:id` | Update customer     | User   |
| DELETE | `/api/customers/:id` | Delete customer     | User   |

### Supplier Routes (`/api/suppliers`)

| Method | Endpoint             | Description         | Access |
| ------ | -------------------- | ------------------- | ------ |
| GET    | `/api/suppliers`     | Get all suppliers   | User   |
| GET    | `/api/suppliers/:id` | Get supplier by ID  | User   |
| POST   | `/api/suppliers`     | Create new supplier | User   |
| PUT    | `/api/suppliers/:id` | Update supplier     | User   |
| DELETE | `/api/suppliers/:id` | Delete supplier     | User   |

### Project Routes (`/api/projects`)

| Method | Endpoint            | Description        | Access |
| ------ | ------------------- | ------------------ | ------ |
| GET    | `/api/projects`     | Get all projects   | User   |
| GET    | `/api/projects/:id` | Get project by ID  | User   |
| POST   | `/api/projects`     | Create new project | User   |
| PUT    | `/api/projects/:id` | Update project     | User   |
| DELETE | `/api/projects/:id` | Delete project     | User   |

### Item Routes (`/api/items`)

| Method | Endpoint         | Description     | Access |
| ------ | ---------------- | --------------- | ------ |
| GET    | `/api/items`     | Get all items   | User   |
| GET    | `/api/items/:id` | Get item by ID  | User   |
| POST   | `/api/items`     | Create new item | User   |
| PUT    | `/api/items/:id` | Update item     | User   |
| DELETE | `/api/items/:id` | Delete item     | User   |

### Purchase Routes (`/api/purchases`)

| Method | Endpoint             | Description         | Access   |
| ------ | -------------------- | ------------------- | -------- |
| GET    | `/api/purchases`     | Get all purchases   | Purchase |
| GET    | `/api/purchases/:id` | Get purchase by ID  | Purchase |
| POST   | `/api/purchases`     | Create new purchase | Purchase |
| PUT    | `/api/purchases/:id` | Update purchase     | Purchase |
| DELETE | `/api/purchases/:id` | Delete purchase     | Purchase |

### Sales Invoice Routes (`/api/sales-invoices`)

| Method | Endpoint                  | Description              | Access |
| ------ | ------------------------- | ------------------------ | ------ |
| GET    | `/api/sales-invoices`     | Get all sales invoices   | Sales  |
| GET    | `/api/sales-invoices/:id` | Get sales invoice by ID  | Sales  |
| POST   | `/api/sales-invoices`     | Create new sales invoice | Sales  |
| PUT    | `/api/sales-invoices/:id` | Update sales invoice     | Sales  |
| DELETE | `/api/sales-invoices/:id` | Delete sales invoice     | Sales  |

### Bank Payment Routes (`/api/bank-payments`)

| Method | Endpoint                 | Description             | Access     |
| ------ | ------------------------ | ----------------------- | ---------- |
| GET    | `/api/bank-payments`     | Get all bank payments   | Accounting |
| GET    | `/api/bank-payments/:id` | Get bank payment by ID  | Accounting |
| POST   | `/api/bank-payments`     | Create new bank payment | Accounting |
| PUT    | `/api/bank-payments/:id` | Update bank payment     | Accounting |
| DELETE | `/api/bank-payments/:id` | Delete bank payment     | Accounting |

### Report Routes (`/api/reports`)

| Method | Endpoint                           | Description          | Access |
| ------ | ---------------------------------- | -------------------- | ------ |
| GET    | `/api/reports/customer-ledger/:id` | Get customer ledger  | User   |
| GET    | `/api/reports/supplier-ledger/:id` | Get supplier ledger  | User   |
| GET    | `/api/reports/project-ledger/:id`  | Get project ledger   | User   |
| GET    | `/api/reports/inventory`           | Get inventory report | User   |
| GET    | `/api/reports/income-statement`    | Get income statement | User   |

### Dashboard Routes (`/api/dashboard`)

| Method | Endpoint               | Description              | Access |
| ------ | ---------------------- | ------------------------ | ------ |
| GET    | `/api/dashboard/stats` | Get dashboard statistics | User   |

### Test Routes

| Method | Endpoint    | Description   | Access |
| ------ | ----------- | ------------- | ------ |
| GET    | `/`         | API status    | Public |
| GET    | `/api/test` | Test endpoint | Public |

## 🔐 User Roles & Permissions

- **admin**: Full system access (all operations)
- **manager**: Management level access
- **accounting**: Financial operations access (journal entries, ledgers, financial statements)
- **purchase**: Purchase transactions and inventory management
- **sales**: Sales invoices and customer management
- **user**: Basic user access (view-only for most features)

## 🌐 CORS Configuration

The API accepts requests from:

- `http://localhost:5173` (Local development)
- `https://construction-management-system-soft.vercel.app` (Production)

## 📦 Scripts

- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests (not configured yet)

## 🚀 Deployment

This project is deployed on Vercel. The deployment automatically triggers on push to the main branch.

### Environment Variables on Vercel

Make sure to set these environment variables in your Vercel project settings:

- `MONGODB_URI`
- `JWT_SECRET`
- `NODE_ENV=production`

## 🔒 Authentication Flow

1. User logs in with email and password
2. Server validates credentials
3. JWT token is generated and returned
4. Client stores token in localStorage
5. Token is sent in Authorization header for protected routes
6. Middleware verifies token on each protected request

## 📝 Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error message"
}
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

ISC

## 👥 Author

- GitHub: [@malikcancode](https://github.com/malikcancode)

## 🐛 Known Issues

- Test scripts need to be configured
- Additional documentation for specific endpoints needed

## 📞 Support

For support, please open an issue in the GitHub repository.
