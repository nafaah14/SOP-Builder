import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DocList } from './DocList';
import { Editor } from '../editor/Editor';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DocList />} />
        <Route path="/doc/:id" element={<Editor />} />
      </Routes>
    </BrowserRouter>
  );
}
