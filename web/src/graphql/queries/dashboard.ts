// The Rust `tasks` query starts at roots, so the dashboard uses the existing
// authorized project list plus the flat, all-depth task read model.
export { GET_PROJECTS as GET_DASHBOARD_PROJECTS } from './projects';
export { TASK_TREE_ROWS as GET_DASHBOARD_TASK_ROWS } from './tasks';
