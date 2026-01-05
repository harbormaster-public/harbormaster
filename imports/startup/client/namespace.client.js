import '../config/namespace';

// Client-only browser bindings
// (kept out of server coverage and server runtime).
H.alert = window.alert.bind(window);
H.confirm = window.confirm.bind(window);
H.window = window;


