import { BrowserRouter, Routes, Route } from "react-router-dom"
import WorkspaceLanding from "@/workspace/WorkspaceLanding"
import RegisterApp from "@/register/RegisterApp"
import SeeApp from "@/see/SeeApp"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WorkspaceLanding />} />
        <Route path="/register" element={<RegisterApp />} />
        <Route path="/see" element={<SeeApp />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
