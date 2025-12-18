import { useState } from "react"
import Menu from "./Menu"
import Loading from "./Loading"
import Visualization from "./Visualization"

function App() {

  const [pageNum, setPageNum] = useState(1)

  return (
    <>
      {pageNum === 1 && (
        <Menu />
      )}
      {pageNum === 2 && (
        <Loading />
      )}
      {pageNum === 3 && (
        <Visualization />
      )}
    </>
  )
}

export default App
