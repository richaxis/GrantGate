import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Watch from "./pages/Watch";
import Create from "./pages/Create";
import Studio from "./pages/Studio";
import Reviews from "./pages/Reviews";
import { Empty } from "./components/ui";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="grant/:id" element={<Watch />} />
        <Route path="create" element={<Create />} />
        <Route path="studio" element={<Studio />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="*" element={<Empty title="Page not found" body="Check the address or head back home." />} />
      </Route>
    </Routes>
  );
}
