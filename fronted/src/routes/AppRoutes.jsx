import { Navigate, Route, Routes } from 'react-router-dom'
import { Shell, Protected } from '../components/SiteLayout.jsx'
import Login from '../pages/auth/Login.jsx'
import Register from '../pages/auth/Register.jsx'
import { ForgotPassword, ResetPassword } from '../pages/auth/PasswordRecovery.jsx'
import { ResendVerification, VerifyEmail } from '../pages/auth/EmailVerification.jsx'
import Drives, { Home } from '../pages/student/Dashboard.jsx'
import DriveDetails from '../pages/student/DriveDetails.jsx'
import Companies from '../pages/student/Companies.jsx'
import CompanyDetails from '../pages/student/CompanyDetails.jsx'
import Applications from '../pages/student/Applications.jsx'
import StudentProfile from '../pages/student/Profile.jsx'
import StudentInterviews from '../pages/student/Interviews.jsx'
import Recommendations from '../pages/student/Recommendations.jsx'
import StudentAnnouncements from '../pages/student/Announcements.jsx'
import AdminDashboard from '../pages/admin/Dashboard.jsx'
import AdminCompanies from '../pages/admin/Companies.jsx'
import AdminDrives from '../pages/admin/Drives.jsx'
import AdminApplications from '../pages/admin/Applications.jsx'
import AdminStudents from '../pages/admin/Students.jsx'
import AdminReports from '../pages/admin/Reports.jsx'
import AdminStaff from '../pages/admin/Staff.jsx'
import AdminAnnouncements from '../pages/admin/Announcements.jsx'
import RecruiterDashboard from '../pages/recruiter/Dashboard.jsx'
import RecruiterDrives from '../pages/recruiter/Drives.jsx'
import RecruiterApplications from '../pages/recruiter/Applications.jsx'
import RecruiterInterviews from '../pages/recruiter/Interviews.jsx'
import RecruiterProfile from '../pages/recruiter/Profile.jsx'

export default function AppRoutes() { 
    return <Shell>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/verify-email" element={<VerifyEmail />} />
                    <Route path="/resend-verification" element={<ResendVerification />} />
                    <Route path="/company" element={<Protected role="COMPANY"><RecruiterDashboard /></Protected>} />
                    <Route path="/company/drives" element={<Protected role="COMPANY"><RecruiterDrives /></Protected>} />
                    <Route path="/company/applications" element={<Protected role="COMPANY"><RecruiterApplications /></Protected>} />
                    <Route path="/company/interviews" element={<Protected role="COMPANY"><RecruiterInterviews /></Protected>} />
                    <Route path="/company/profile" element={<Protected role="COMPANY"><RecruiterProfile /></Protected>} />
                    <Route path="/drives" element={<Drives />} />
                    <Route path="/drives/:id" element={<DriveDetails />} />
                    <Route path="/companies" element={<Companies />} />
                    <Route path="/companies/:id" element={<CompanyDetails />} />
                    <Route path="/applications" element={<Protected role="STUDENT"><Applications /></Protected>} />
                    <Route path="/interviews" element={<Protected role="STUDENT"><StudentInterviews /></Protected>} />
                    <Route path="/recommendations" element={<Protected role="STUDENT"><Recommendations /></Protected>} />
                    <Route path="/announcements" element={<Protected role="STUDENT"><StudentAnnouncements /></Protected>} />
                    <Route path="/profile" element={<Protected role="STUDENT"><StudentProfile /></Protected>} />
                    <Route path="/admin" element={<Protected manager><AdminDashboard /></Protected>} />
                    <Route path="/admin/companies" element={<Protected manager><AdminCompanies /></Protected>} />
                    <Route path="/admin/drives" element={<Protected manager><AdminDrives /></Protected>} />
                    <Route path="/admin/applications" element={<Protected manager><AdminApplications /></Protected>} />
                    <Route path="/admin/students" element={<Protected manager><AdminStudents /></Protected>} />
                    <Route path="/admin/reports" element={<Protected manager><AdminReports /></Protected>} />
                    <Route path="/admin/staff" element={<Protected role="ADMIN"><AdminStaff /></Protected>} />
                    <Route path="/admin/announcements" element={<Protected manager><AdminAnnouncements /></Protected>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Shell> }
