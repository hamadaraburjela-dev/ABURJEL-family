# Injury Registration and Management Application

This project is a web application designed for registering injuries and managing related data. It provides a user-friendly interface for both users and administrators to handle injury registrations and oversee the management of injury records.

## Features

- **Injury Registration**: Users can register injuries using a dedicated form.
- **Martyr Registration**: A separate form is available for registering martyrs.
- **Admin Dashboard**: Administrators can manage injuries, including viewing, editing, and deleting records.
- **Reusable Components**: The application utilizes reusable UI components for buttons and input fields to maintain consistency.

## Project Structure

```
injuries-app
├── src
│   ├── App.tsx                  # Main application component
│   ├── index.tsx                # Entry point of the application
│   ├── pages
│   │   ├── MartyrRegistration.tsx # Component for martyr registration
│   │   ├── InjuryRegistration.tsx  # Component for injury registration
│   │   └── admin
│   │       └── InjuriesManagement.tsx # Admin component for managing injuries
│   ├── components
│   │   ├── forms
│   │   │   ├── MartyrForm.tsx      # Form component for martyr registration
│   │   │   └── InjuryForm.tsx       # Form component for injury registration
│   │   ├── layout
│   │   │   ├── Header.tsx           # Header component
│   │   │   └── DashboardLayout.tsx   # Layout component for the dashboard
│   │   └── ui
│   │       ├── Button.tsx           # Reusable button component
│   │       └── Input.tsx            # Reusable input component
│   ├── hooks
│   │   └── useForm.ts               # Custom hook for form management
│   ├── services
│   │   └── api.ts                   # API service functions
│   ├── store
│   │   ├── index.ts                 # Redux store setup
│   │   └── injuriesSlice.ts         # Redux slice for injuries
│   ├── types
│   │   └── index.ts                 # TypeScript types and interfaces
│   └── styles
│       └── globals.css              # Global CSS styles
├── public
│   └── index.html                   # Main HTML file
├── package.json                     # npm configuration file
├── tsconfig.json                    # TypeScript configuration file
└── README.md                        # Project documentation
```

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd injuries-app
   ```
3. Install the dependencies:
   ```
   npm install
   ```

## Usage

To start the application, run:
```
npm start
```
This will launch the application in your default web browser.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License.