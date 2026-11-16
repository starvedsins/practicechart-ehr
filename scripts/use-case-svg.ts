import { writeFile } from "node:fs/promises";
const escape = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1000" viewBox="0 0 1200 1000"><defs><marker id="open" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0 0L9 5L0 10" fill="none" stroke="#42536b"/></marker></defs><rect width="1200" height="1000" fill="white"/><style>text{font-family:Arial,sans-serif;font-size:15px;fill:#182a40}.edge{stroke:#788ba1;stroke-width:1.2;fill:none}.case{stroke:#788ba1;fill:#f4f7fb}.actor{stroke:#42536b;stroke-width:1.8;fill:none}</style><text x="600" y="30" text-anchor="middle" font-size="22">PracticeChart EHR use cases</text><rect x="190" y="60" width="820" height="890" fill="none" stroke="#788ba1"/><text x="600" y="82" text-anchor="middle">PracticeChart EHR</text>`;
function actor(x: number, y: number, label: string) {
  return `<circle class="actor" cx="${x}" cy="${y}" r="14"/><path class="actor" d="M${x} ${y + 14}V${y + 65}M${x - 25} ${y + 35}H${x + 25}M${x} ${y + 65}L${x - 23} ${y + 95}M${x} ${y + 65}L${x + 23} ${y + 95}"/><text x="${x}" y="${y + 119}" text-anchor="middle">${escape(label)}</text>`;
}
function usecase(x: number, y: number, label: string) {
  const words = label.split(" "),
    lines: string[] = [];
  for (const word of words) {
    if (!lines.length || lines.at(-1)!.length + word.length > 29)
      lines.push(word);
    else lines[lines.length - 1] += " " + word;
  }
  return `<ellipse class="case" cx="${x}" cy="${y}" rx="160" ry="27"/><text x="${x}" y="${y - (lines.length - 1) * 8 + 5}" text-anchor="middle">${lines.map((s, i) => `<tspan x="${x}" dy="${i ? 17 : 0}">${escape(s)}</tspan>`).join("")}</text>`;
}
const office = [
  "Register and update patient",
  "Manage appointments",
  "Generate schedule report",
  "Retrieve patient file",
  "Create interim record",
  "Record visit in system",
  "File ready patient visit",
  "Generate digital invoice",
  "Upload medical documents",
  "Track patient visit analytics",
];
const care = [
  "Record diagnosis and treatment",
  "Generate medical certificate",
  "Generate prescription",
  "Add lab test results",
  "Review clinical history",
  "Correct clinical entry",
  "Retrieve diagnostic report",
];
office.forEach((s, i) => {
  const y = 240 + i * 65;
  svg += `<path class="edge" d="M80 420L240 ${y}"/>` + usecase(400, y, s);
});
care.forEach((s, i) => {
  const y = 330 + i * 75;
  svg += `<path class="edge" d="M1120 490L960 ${y}"/>` + usecase(800, y, s);
});
svg +=
  `<path class="edge" d="M80 130L240 135M80 420L240 135M1120 130L960 135M1120 130L960 215"/>` +
  usecase(400, 135, "Complete registration form") +
  usecase(800, 135, "Generate appointment email confirmation") +
  usecase(800, 215, "Send appointment reminders");
svg += `<path class="edge" stroke-dasharray="5 4" marker-end="url(#open)" d="M400 213V162"/><text x="468" y="192" text-anchor="middle">&lt;&lt;include&gt;&gt;</text><path class="edge" stroke-dasharray="5 4" marker-end="url(#open)" d="M400 473V462"/><text x="487" y="471">&lt;&lt;extend&gt;&gt;</text>`;
svg +=
  `<path class="edge" d="M80 420H165V890H440M1120 490H1035V890H760"/>` +
  `<ellipse class="case" cx="600" cy="890" rx="160" ry="27"/><text x="600" y="895" text-anchor="middle">Staff login / logout</text>`;
svg +=
  actor(80, 95, "Patient") +
  actor(80, 380, "Receptionist") +
  actor(1120, 95, "Email notifications") +
  actor(1120, 450, "Doctor") +
  "</svg>";
await writeFile("docs/diagrams/use_case.svg", svg);
