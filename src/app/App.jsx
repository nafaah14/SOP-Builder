import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DocList } from './DocList';
import { Editor } from '../editor/Editor';
import { TemplatesPage } from '../templates/TemplatesPage';
import { TemplateEditor } from '../templates/TemplateEditor';
import { UpdateCheck } from './UpdateCheck';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DocList />} />
        <Route path="/doc/:id" element={<Editor />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/templates/:id" element={<TemplateEditor />} />
      </Routes>
      <UpdateCheck />
    </BrowserRouter>
  );
}
