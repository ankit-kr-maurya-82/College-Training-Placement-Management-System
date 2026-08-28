install packages<br>
npm i dotenv<br>
npm i express<br>
npm i mongoose<br>
npm i -D nodemon<br>
npm i -D prettier<br>
npm i cookie-parser<br>
npm i cors<br>

## Backend Folder Structure<br>
backend/
│
├── src/
│   ├── config/
│   │   ├── db.js
│   │   └── cloudinary.js
│   │
│   ├── models/
│   │   ├── User.js
│   │   ├── Student.js
│   │   ├── Company.js
│   │   ├── Drive.js
│   │   ├── Application.js
│   │   ├── Interview.js
│   │   ├── Notification.js
│   │   ├── Material.js
│   │   ├── Announcement.js
│   │   └── Placement.js
│   │
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── studentController.js
│   │   ├── companyController.js
│   │   ├── driveController.js
│   │   ├── applicationController.js
│   │   ├── interviewController.js
│   │   ├── notificationController.js
│   │   └── adminController.js
│   │
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── studentRoutes.js
│   │   ├── companyRoutes.js
│   │   ├── driveRoutes.js
│   │   ├── applicationRoutes.js
│   │   ├── interviewRoutes.js
│   │   └── notificationRoutes.js
│   │
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   ├── roleMiddleware.js
│   │   └── uploadMiddleware.js
│   │
│   ├── services/
│   │   ├── eligibilityService.js
│   │   ├── notificationService.js
│   │   └── emailService.js
│   │
│   ├── utils/
│   │   └── generateToken.js
│   │
│   ├── app.js
│   └── server.js
│
├── .env
├── package.json
└── README.md