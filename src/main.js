// App Entry Point

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(new URL('./sw/service-worker.js', import.meta.url), { type: 'module' })
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// Basic Render
document.querySelector('#app').innerHTML = `
  <div>
    <h1>Release Tracker</h1>
    <p>Placeholder Page</p>
  </div>
`;
