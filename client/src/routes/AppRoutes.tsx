import {
  BrowserRouter,
  Route,
  Routes,
} from "react-router-dom";

import MainLayout from "../layouts/MainLayout";

import Home from "../pages/Home";
import Login from "../pages/Login";
import Register from "../pages/Register";
import Movies from "../pages/Movies";
import MovieDetails from "../pages/MovieDetails";
import ShowSelection from "../pages/ShowSelection";
import SeatSelection from "../pages/SeatSelection";
import Checkout from "../pages/Checkout";
import BookingSuccess from "../pages/BookingSuccess";
import MyBookings from "../pages/MyBookings";
import BookingDetails from "../pages/BookingDetails";
import Profile from "../pages/Profile";
import Wallet from "../pages/Wallet";

import AdminDashboard from "../pages/AdminDashboard";
import AdminMovies from "../pages/AdminMovies";
import AdminTheatres from "../pages/AdminTheatres";
import AdminShows from "../pages/AdminShows";
import AdminBookings from "../pages/AdminBookings";
import AdminScreens from "../pages/AdminScreens";
import AdminReports from "../pages/AdminReports";
import AdminUsers from "../pages/AdminUsers";

import NotFound from "../pages/NotFound";
import ProtectedRoute from "../routes/ProtectedRoute";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/movies/:id" element={<MovieDetails />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/movies/:id/shows" element={<ShowSelection />} />
            <Route path="/shows/:showId/seats" element={<SeatSelection />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/checkout/:bookingId" element={<Checkout />} />
            <Route path="/booking-success/:id" element={<BookingSuccess />} />
            <Route path="/bookings" element={<MyBookings />} />
            <Route path="/bookings/:id" element={<BookingDetails />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/wallet" element={<Wallet />} />
          </Route>

          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/movies" element={<AdminMovies />} />
            <Route path="/admin/theatres" element={<AdminTheatres />} />
            <Route path="/admin/screens" element={<AdminScreens />} />
            <Route path="/admin/shows" element={<AdminShows />} />
            <Route path="/admin/bookings" element={<AdminBookings />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/users" element={<AdminUsers />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;