import { getAllDemos } from './demos.js';
import { getAllProjects } from './projects.js';

export async function search(query) {
  if (!query?.trim()) return { demos: [], projects: [] };
  const q = query.toLowerCase();
  const [demos, projects] = await Promise.all([getAllDemos(), getAllProjects()]);
  const matchDemo = (d) =>
    d.title?.toLowerCase().includes(q) ||
    d.notes?.toLowerCase().includes(q) ||
    d.tags?.some((t) => t.toLowerCase().includes(q));
  const matchProject = (p) =>
    p.title?.toLowerCase().includes(q) ||
    p.notes?.toLowerCase().includes(q) ||
    p.tags?.some((t) => t.toLowerCase().includes(q));
  return {
    demos: demos.filter(matchDemo),
    projects: projects.filter(matchProject),
  };
}
