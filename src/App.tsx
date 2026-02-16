import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/context/auth";
import { useAuth } from "@/context/auth";
import { AppSettingsProvider, useAppSettings } from "@/hooks/useAppSettings";
import { CookieConsentProvider } from "@/context/CookieConsentContext";
import CookieBanner from "@/components/CookieBanner";
import { Routes as AppRoutes } from "./routes";
import { SpeedInsights } from "@vercel/speed-insights/react"
import { Analytics } from "@vercel/analytics/react"
import Index from "./pages/Index";
import LoadingSpinner from "@/components/ui/loading";
import { AuthenticatedRoute, AdminRoute } from "@/components/auth/ProtectedRoutes";
import { SetupGuard } from "@/components/SetupGuard";
import { SetupRedirect } from "@/components/SetupRedirect";
import Favicon from "@/components/Favicon";

// Lazy load admin pages for better performance
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminNewsPage = lazy(() => import("./pages/admin/news/AdminNewsPage"));
const AdminNewsEditorPage = lazy(() => import("./pages/admin/news/AdminNewsEditorPage"));
const AdminNewsPreviewPage = lazy(() => import("./pages/admin/news/AdminNewsPreviewPage"));
const AdminEventsPage = lazy(() => import("./pages/admin/events/AdminEventsPage"));
const AdminEventEditorPage = lazy(() => import("./pages/admin/events/AdminEventEditorPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminPagesPage = lazy(() => import("./pages/admin/pages/AdminPagesPage"));
const AdminPageEditorPage = lazy(() => import("./pages/admin/pages/AdminPageEditorPage"));
const AdminCommitteesPage = lazy(() => import("./pages/admin/committees/AdminCommitteesPage"));
const AdminCommitteeEditorPage = lazy(() => import("./pages/admin/committees/AdminCommitteeEditorPage"));
const AdminMenuPage = lazy(() => import("./pages/admin/AdminMenuPage"));
const AdminGalaxyPage = lazy(() => import("./pages/admin/AdminGalaxyPage"));
const AdminGalaxyEditorPage = lazy(() => import("./pages/admin/AdminGalaxyEditorPage"));
const AdminProgramPage = lazy(() => import("./pages/admin/program/AdminProgramPage"));
const AdminProgramEditorPage = lazy(() => import("./pages/admin/program/AdminProgramEditorPage"));
const AdminProjectsPage = lazy(() => import("./pages/admin/projects/AdminProjectsPage"));
const AdminProjectEditorPage = lazy(() => import("./pages/admin/projects/AdminProjectEditorPage"));
const AdminSupportCommitteePage = lazy(() => import("./pages/admin/AdminSupportCommitteePage"));
const AdminLexiconPage = lazy(() => import("./pages/admin/AdminLexiconPage"));
const AdminLexiconEditorPage = lazy(() => import("./pages/admin/AdminLexiconEditorPage"));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage"));
const AdminTeamMemberNewPage = lazy(() => import("./pages/admin/team/AdminTeamMemberNewPage"));
const AdminTeamMemberEditPage = lazy(() => import("./pages/admin/team/AdminTeamMemberEditPage"));
const AdminElectoralListPage = lazy(() => import("./pages/admin/electoral/AdminElectoralListPage"));
const AdminFAQPage = lazy(() => import("./pages/admin/faq/AdminFAQPage"));
const AdminFAQEditorPage = lazy(() => import("./pages/admin/faq/AdminFAQEditorPage"));
const AdminExternalContactFormPage = lazy(() => import("./pages/admin/external/AdminExternalContactFormPage"));
const AdminExternalGroupFormPage = lazy(() => import("./pages/admin/external/AdminExternalGroupFormPage"));
const AdminExternalDirectoryPage = lazy(() => import("./pages/admin/external/AdminExternalDirectoryPage"));
const AdminProcurationPage = lazy(() => import("./pages/admin/AdminProcurationPage"));
const DirectoryPage = lazy(() => import("./pages/DirectoryPage"));

// Other pages
const NewsPage = lazy(() => import("./pages/NewsPage"));
const NewsDetailPage = lazy(() => import("./pages/NewsDetailPage"));
const AgendaPage = lazy(() => import("./pages/AgendaPage"));
const EventDetailPage = lazy(() => import("./pages/EventDetailPage"));
const NeighborhoodEventsPage = lazy(() => import("./pages/NeighborhoodEventsPage"));
const NeighborhoodKitPage = lazy(() => import("./pages/NeighborhoodKitPage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const CommitteePage = lazy(() => import("./pages/CommitteePage"));
const ProgramPage = lazy(() => import("./pages/ProgramPage"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const JoinPage = lazy(() => import("./pages/JoinPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const SiteMapPage = lazy(() => import("./pages/SiteMapPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const AuthCallbackPage = lazy(() => import("./pages/AuthCallbackPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const DynamicPage = lazy(() => import("./pages/DynamicPage"));
const LiftPage = lazy(() => import("./pages/LiftPage"));
const ProcurationPage = lazy(() => import("./pages/ProcurationPage"));
const SetupWizardPage = lazy(() => import("./pages/SetupWizardPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function AdminProtectedOutlet() {
  return (
    <AdminRoute>
      <Outlet />
    </AdminRoute>
  );
}

function AppRouter() {
  const { settings, loading } = useAppSettings();
  const { isAdmin } = useAuth();
  const showJoin = settings.modules.supportCommittee || settings.modules.membershipForm;

  const guardedElement = (enabled: boolean, element: React.ReactNode) =>
    enabled ? element : <NotFound />;

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <SetupRedirect />
      <Routes>
      <Route path={AppRoutes.HOME} element={<Index />} />
      <Route path={AppRoutes.NEWS} element={guardedElement(settings.modules.blog, <NewsPage />)} />
      <Route path={AppRoutes.NEWS_DETAIL} element={guardedElement(settings.modules.blog, <NewsDetailPage />)} />
      <Route path={AppRoutes.AGENDA} element={guardedElement(settings.modules.agenda, <AgendaPage />)} />
      <Route path={AppRoutes.EVENT_DETAIL} element={guardedElement(settings.modules.agenda, <EventDetailPage />)} />
      <Route path={AppRoutes.NEIGHBORHOOD_EVENTS} element={guardedElement(settings.modules.agenda, <NeighborhoodEventsPage />)} />
      <Route path={AppRoutes.NEIGHBORHOOD_KIT} element={guardedElement(settings.modules.agenda, <NeighborhoodKitPage />)} />
      <Route path={AppRoutes.TEAM_DETAIL} element={guardedElement(settings.modules.team || isAdmin, <TeamPage />)} />
      <Route path={AppRoutes.TEAM} element={guardedElement(settings.modules.team || isAdmin, <TeamPage />)} />
      <Route path={AppRoutes.COMMITTEES} element={guardedElement(settings.modules.committees, <CommitteePage />)} />
      <Route path={AppRoutes.COMMITTEE_DETAIL} element={guardedElement(settings.modules.committees, <CommitteePage />)} />
      <Route path={AppRoutes.PROGRAM} element={guardedElement(settings.modules.program, <ProgramPage />)} />
      <Route path={AppRoutes.PROJECTS} element={guardedElement(settings.modules.projects, <ProjectsPage />)} />
      <Route path={AppRoutes.SUPPORT_COMMITTEE} element={guardedElement(showJoin, <JoinPage />)} />
      <Route path={AppRoutes.JOIN} element={guardedElement(showJoin, <JoinPage />)} />
      <Route path={AppRoutes.CONTACT} element={<ContactPage />} />
      <Route path={AppRoutes.LEGAL} element={<LegalPage />} />
      <Route path={AppRoutes.SITEMAP} element={<SiteMapPage />} />
      <Route path={AppRoutes.AUTH} element={<AuthPage />} />
      <Route path={AppRoutes.AUTH_CALLBACK} element={<AuthCallbackPage />} />
      <Route path={AppRoutes.AUTH_RESET_PASSWORD} element={<ResetPasswordPage />} />
      <Route path={AppRoutes.PROFILE} element={
        <AuthenticatedRoute>
          <ProfilePage />
        </AuthenticatedRoute>
      } />
      <Route path={AppRoutes.LIFT} element={<LiftPage />} />
      <Route path={AppRoutes.PROXY} element={guardedElement(settings.modules.proxy, <ProcurationPage />)} />

      {/* Wizard de configuration (après premier admin) : réservé aux admins ou au premier passage */}
      <Route path={AppRoutes.SETUP_WIZARD} element={
        <AuthenticatedRoute>
          <SetupWizardPage />
        </AuthenticatedRoute>
      } />
      
      {/* Admin Routes - All protected by AdminRoute via nested routes */}
      <Route element={<AdminProtectedOutlet />}>
        {/* Directory */}
        <Route path={AppRoutes.DIRECTORY} element={<DirectoryPage />} />
        <Route path={AppRoutes.DIRECTORY_INTERNAL} element={<DirectoryPage />} />
        <Route path={AppRoutes.DIRECTORY_EXTERNAL} element={<DirectoryPage />} />
        <Route path={AppRoutes.ADMIN} element={<AdminDashboardPage />} />
        
        {/* News */}
        <Route path={AppRoutes.ADMIN_NEWS} element={<AdminNewsPage />} />
        <Route path={AppRoutes.ADMIN_NEWS_NEW} element={<AdminNewsEditorPage />} />
        <Route path={AppRoutes.ADMIN_NEWS_EDIT} element={<AdminNewsEditorPage />} />
        <Route path={AppRoutes.ADMIN_NEWS_PREVIEW} element={<AdminNewsPreviewPage />} />
        
        {/* Events */}
        <Route path={AppRoutes.ADMIN_EVENTS} element={<AdminEventsPage />} />
        <Route path={AppRoutes.ADMIN_EVENTS_NEW} element={<AdminEventEditorPage />} />
        <Route path={AppRoutes.ADMIN_EVENTS_EDIT} element={<AdminEventEditorPage />} />
        
        {/* Users */}
        <Route path={AppRoutes.ADMIN_USERS} element={<AdminUsersPage />} />
        
        {/* Pages */}
        <Route path={AppRoutes.ADMIN_PAGES} element={<AdminPagesPage />} />
        <Route path={AppRoutes.ADMIN_PAGES_NEW} element={<AdminPageEditorPage />} />
        <Route path={AppRoutes.ADMIN_PAGES_EDIT} element={<AdminPageEditorPage />} />
        
        {/* Committees */}
        <Route path={AppRoutes.ADMIN_COMMITTEES} element={<AdminCommitteesPage />} />
        <Route path={AppRoutes.ADMIN_COMMITTEES_NEW} element={<AdminCommitteeEditorPage />} />
        <Route path={AppRoutes.ADMIN_COMMITTEES_EDIT} element={<AdminCommitteeEditorPage />} />
        
        {/* Menu */}
        <Route path={AppRoutes.ADMIN_MENU} element={<AdminMenuPage />} />
        
        {/* Galaxy */}
        <Route path={AppRoutes.ADMIN_GALAXY} element={<AdminGalaxyPage />} />
        <Route path={AppRoutes.ADMIN_GALAXY_NEW} element={<AdminGalaxyEditorPage />} />
        <Route path={AppRoutes.ADMIN_GALAXY_EDIT} element={<AdminGalaxyEditorPage />} />
        
        {/* Program */}
        <Route path={AppRoutes.ADMIN_PROGRAM} element={<AdminProgramPage />} />
        <Route path={AppRoutes.ADMIN_PROGRAM_EDIT} element={<AdminProgramEditorPage />} />
        
        {/* Projects */}
        <Route path={AppRoutes.ADMIN_PROJECTS} element={<AdminProjectsPage />} />
        <Route path={AppRoutes.ADMIN_PROJECTS_NEW} element={<AdminProjectEditorPage />} />
        <Route path={AppRoutes.ADMIN_PROJECTS_EDIT} element={<AdminProjectEditorPage />} />
        
        {/* Lexicon */}
        <Route path={AppRoutes.ADMIN_LEXICON} element={<AdminLexiconPage />} />
        <Route path={AppRoutes.ADMIN_LEXICON_NEW} element={<AdminLexiconEditorPage />} />
        <Route path={AppRoutes.ADMIN_LEXICON_EDIT} element={<AdminLexiconEditorPage />} />
        
        {/* Support Committee */}
        <Route path={AppRoutes.ADMIN_SUPPORT_COMMITTEE} element={<AdminSupportCommitteePage />} />
        
        {/* Team Members */}
        <Route path={AppRoutes.ADMIN_TEAM_MEMBERS_NEW} element={<AdminTeamMemberNewPage />} />
        <Route path={AppRoutes.ADMIN_TEAM_MEMBERS_EDIT} element={<AdminTeamMemberEditPage />} />
        
        {/* Team */}
        <Route path={AppRoutes.ADMIN_TEAM} element={<AdminElectoralListPage />} />
        
        {/* FAQ */}
        <Route path={AppRoutes.ADMIN_FAQ} element={<AdminFAQPage />} />
        <Route path={AppRoutes.ADMIN_FAQ_EDIT} element={<AdminFAQEditorPage />} />
        
        {/* Procuration */}
        <Route path={AppRoutes.ADMIN_PROXY} element={<AdminProcurationPage />} />
        
        {/* External Directory */}
        <Route path={AppRoutes.ADMIN_EXTERNAL_DIRECTORY} element={<AdminExternalDirectoryPage />} />
        <Route path={AppRoutes.ADMIN_EXTERNAL_CONTACTS_NEW} element={<AdminExternalContactFormPage />} />
        <Route path={AppRoutes.ADMIN_EXTERNAL_CONTACTS_EDIT} element={<AdminExternalContactFormPage />} />
        <Route path={AppRoutes.ADMIN_EXTERNAL_GROUPS_NEW} element={<AdminExternalGroupFormPage />} />
        <Route path={AppRoutes.ADMIN_EXTERNAL_GROUPS_EDIT} element={<AdminExternalGroupFormPage />} />
        
        {/* Settings */}
        <Route path={AppRoutes.ADMIN_SETTINGS} element={<AdminSettingsPage />} />
      </Route>

      {/* Dynamic pages - this should be last */}
      <Route path={AppRoutes.DYNAMIC_PAGE} element={<DynamicPage />} />
      <Route path={AppRoutes.NOT_FOUND} element={<NotFound />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <TooltipProvider>
          <CookieConsentProvider>
            <AuthProvider>
              <AppSettingsProvider>
                <SpeedInsights />
                <Analytics />
                <Toaster />
                <Sonner />
                <Favicon />
                <BrowserRouter>
                  <SetupGuard>
                    <Suspense fallback={<LoadingSpinner />}>
                      <AppRouter />
                    </Suspense>
                  </SetupGuard>
                </BrowserRouter>
                <CookieBanner />
              </AppSettingsProvider>
            </AuthProvider>
          </CookieConsentProvider>
        </TooltipProvider>
      </HelmetProvider>
    </QueryClientProvider>
  );
}

export default App;
