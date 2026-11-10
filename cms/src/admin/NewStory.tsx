import { Navigate } from 'react-router-dom';

// "New story" in the left menu: straight to a blank story in the editor.
export const NEW_STORY = '/content-manager/collection-types/api::article.article/create';

export default function NewStory() {
  return <Navigate to={NEW_STORY} replace />;
}
