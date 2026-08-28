install packages<br>
npm i dotenv<br>
npm i express<br>
npm i mongoose<br>
npm i -D nodemon<br>
npm i -D prettier<br>
npm i cookie-parser<br>
npm i cors<br>

## Backend Folder Structure<br>
backend/<br>
│<br>
├── src/<br>
│   ├── config/<br>
│   │   ├── db.js<br>
│   │   └── cloudinary.js<br>
│   │<br>
│   ├── models/<br>
│   │   ├── User.js<br>
│   │   ├── Student.js<br>
│   │   ├── Company.js<br>
│   │   ├── Drive.js<br>
│   │   ├── Application.js<br>
│   │   ├── Interview.js<br>
│   │   ├── Notification.js<br>
│   │   ├── Material.js<br>
│   │   ├── Announcement.js<br>
│   │   └── Placement.js<br>
│   │<br>
│   ├── controllers/<br>
│   │   ├── authController.js<br>
│   │   ├── studentController.js<br>
│   │   ├── companyController.js<br>
│   │   ├── driveController.js<br>
│   │   ├── applicationController.js<br>
│   │   ├── interviewController.js<br>
│   │   ├── notificationController.js<br>
│   │   └── adminController.js<br>
│   │<br>
│   ├── routes/<br>
│   │   ├── authRoutes.js<br>
│   │   ├── studentRoutes.js<br>
│   │   ├── companyRoutes.js<br>
│   │   ├── driveRoutes.js<br>
│   │   ├── applicationRoutes.js<br>
│   │   ├── interviewRoutes.js<br>
│   │   └── notificationRoutes.js<br>
│   │<br>
│   ├── middleware/<br>
│   │   ├── authMiddleware.js<br>
│   │   ├── roleMiddleware.js<br>
│   │   └── uploadMiddleware.js<br>
│   │<br>
│   ├── services/<br>
│   │   ├── eligibilityService.js<br>
│   │   ├── notificationService.js<br>
│   │   └── emailService.js<br>
│   │<br>
│   ├── utils/<br>
│   │   └── generateToken.js<br>
│   │<br>
│   ├── app.js<br>
│   └── server.js<br>
│<br>
├── .env<br>
├── package.json<br>
└── README.md<br>