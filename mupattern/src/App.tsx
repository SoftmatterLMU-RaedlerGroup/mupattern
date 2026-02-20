import { BrowserRouter, Routes, Route } from "react-router-dom"
import Landing from "@/Landing"
import RegisterApp from "@/register/RegisterApp"
import SeeApp from "@/see/SeeApp"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/register" element={<RegisterApp />} />
        <Route path="/see" element={<SeeApp />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
