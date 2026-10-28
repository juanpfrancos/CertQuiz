// UI layer entry point: re-exports every view and shared component.
export { renderHome } from './HomeView.js';
export { mountQuiz } from './QuizView.js';
export { renderResults } from './ResultsView.js';
export { renderHistory } from './HistoryView.js';
export { renderSettings } from './SettingsView.js';
export { toast, openModal, confirmDialog, isModalOpen } from './components.js';
export { h, downloadJSON, fmtDuration } from './dom.js';
