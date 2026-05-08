// Toggle calendar visibility (no longer needed for initial state)
function toggleCalendar() {
  const el = document.getElementById("calendar-container");
  const btn = document.getElementById("calendar-toggle-btn");
  const isHidden = el.style.display === "none";
  el.style.display = isHidden ? "block" : "none";
  btn.innerText = isHidden ? "Esconder Calendario" : "Mostrar Calendario";

  // Update calendar URL when toggling to ensure correct theme
  if (isHidden) {
    updateCalendarUrl();
  }
}

// Initialize calendar on page load
document.addEventListener("DOMContentLoaded", function() {
  const el = document.getElementById("calendar-container");
  if (el) {
    el.style.display = "block"; // Ensure the calendar is visible
    // You might want to update the button text too if it exists and is relevant
    const btn = document.getElementById("calendar-toggle-btn");
    if (btn) {
      btn.innerText = "Esconder Calendario"; // Set initial button text to "Hide"
    }
  }
  updateCalendarUrl();
});

