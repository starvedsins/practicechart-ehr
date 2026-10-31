import ts from "typescript-compiler";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { instance } from "@viz-js/viz";
type Node = {
  id: number;
  label: string;
  kind: "action" | "decision" | "end";
  line: number;
};
type Edge = { from: number; to: number; label: string };
type Tail = { from: number; label: string };
const viz = await instance();
await mkdir("docs/diagrams/cfg", { recursive: true });
const narratives: Record<string, string> = {
  patientList:
    "Search demographic records with parameters and record the search event.",
  patientDetail:
    "Read a patient and visits. Add clinical history and documents only for a doctor.",
  savePatient:
    "Validate demographics. Create an MRN or update the expected record version. Warn about possible duplicates.",
  archivePatient:
    "Require a doctor and the current version before changing patient archive status.",
  reconcilePatient:
    "Require a doctor. Lock both records and link an unresolved provisional record to its primary record.",
  schedule:
    "Read the appointments for one Jamaica calendar day and record the view.",
  availability:
    "Find future half-hour start slots inside doctor hours and outside bookings and blocked periods.",
  bookAppointment:
    "Validate the interval and active patient. Insert a confirmed booking or update a current confirmed booking. Audit only a committed change.",
  appointmentStatus:
    "Change a current confirmed appointment to arrived or cancelled. Preserve the booking record.",
  startVisit:
    "Create a walk-in visit or start a matching appointment. Keep its doctor and patient association.",
  saveClinical:
    "Require doctor access. Lock the visit, check its revision, and append a draft, final entry, or reasoned final correction.",
  fileVisit:
    "Lock the visit. Require the current final diagnosis. File the visit and complete its appointment.",
  saveInvoice:
    "Validate service lines and calculate integer-cent totals before creating an invoice draft.",
  setInvoiceStatus:
    "Issue a draft or void an issued invoice with a reason. Reject stale versions.",
  invoiceList: "Read administrative invoice data and record the view.",
  manageUser:
    "Require doctor access. Create or change an account. Protect demo accounts, keep a doctor active, and revoke changed sessions.",
  changePassword:
    "Verify the current password, hash the replacement, and revoke existing sessions.",
  dashboard:
    "Read practice counts, ready visits, and in-app reminders without clinical note bodies.",
  reportData:
    "Select the report type, require clinical permission where needed, and record an export event.",
  requireRole: "Check the server account role and audit denied access.",
  getSession:
    "Hash the cookie token and find an unexpired session for an active account.",
  login:
    "Limit attempts, verify a password hash, create a random hashed session, and record the result.",
  storeFile:
    "Validate length, signature, and public demo sample rules before writing an immutable private object.",
  readPrivateFile:
    "Reject unsafe paths and retrieve a private object. Return a clear missing-file error.",
  invoiceTotal:
    "Sum integer quantity times unit cents and reject unsafe or excessive totals.",
  fileMime: "Classify only PDF, PNG, or JPEG file signatures.",
};
const files = [
  "src/lib/service.ts",
  "src/lib/auth.ts",
  "src/lib/storage.ts",
  "src/lib/validation.ts",
];
const graphs = [];
let moduleText =
  "# Processing narratives and pseudocode\n\nGenerated from the current application source. The source listing remains the detailed programme reference. SQL and library internals are represented as calls. Transaction callbacks are expanded. Array callbacks stay within their library operation. The graphs cover explicit application branches, short-circuit conditions, conditional expressions, and loops. A try block includes an explicit I/O failure branch. External library internals are not counted.\n\n";
for (const file of files) {
  const source = await readFile(file, "utf8");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  for (const declaration of sf.statements) {
    if (
      !ts.isFunctionDeclaration(declaration) ||
      !declaration.body ||
      !declaration.name ||
      !narratives[declaration.name.text]
    )
      continue;
    const name = declaration.name.text;
    const nodes: Node[] = [
      { id: 1, label: "START", kind: "end", line: 0 },
      { id: 2, label: "END", kind: "end", line: 0 },
    ];
    const edges: Edge[] = [];
    const code = (n: ts.Node) => n.getText(sf).replace(/\s+/g, " ").trim();
    const add = (
      label: string,
      kind: Node["kind"] = "action",
      node?: ts.Node,
    ) => {
      const id = nodes.length + 1;
      nodes.push({
        id,
        label: label.slice(0, 150),
        kind,
        line: node
          ? sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
          : 0,
      });
      return id;
    };
    const connect = (tails: Tail[], id: number) => {
      for (const t of tails)
        edges.push({ from: t.from, to: id, label: t.label });
    };
    const action = (label: string, tails: Tail[], node?: ts.Node) => {
      const id = add(label, "action", node);
      connect(tails, id);
      return [{ from: id, label: "" }];
    };
    function condition(
      expr: ts.Expression,
      tails: Tail[],
    ): { yes: Tail[]; no: Tail[] } {
      if (ts.isParenthesizedExpression(expr))
        return condition(expr.expression, tails);
      if (
        ts.isPrefixUnaryExpression(expr) &&
        expr.operator === ts.SyntaxKind.ExclamationToken
      ) {
        const c = condition(expr.operand, tails);
        return { yes: c.no, no: c.yes };
      }
      if (
        ts.isBinaryExpression(expr) &&
        expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      ) {
        const a = condition(expr.left, tails),
          b = condition(expr.right, a.yes);
        return { yes: b.yes, no: [...a.no, ...b.no] };
      }
      if (
        ts.isBinaryExpression(expr) &&
        expr.operatorToken.kind === ts.SyntaxKind.BarBarToken
      ) {
        const a = condition(expr.left, tails),
          b = condition(expr.right, a.no);
        return { yes: [...a.yes, ...b.yes], no: b.no };
      }
      const id = add(code(expr), "decision", expr);
      connect(tails, id);
      return {
        yes: [{ from: id, label: "True" }],
        no: [{ from: id, label: "False" }],
      };
    }
    function expression(expr: ts.Node, tails: Tail[]): Tail[] {
      if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr))
        return tails;
      if (ts.isConditionalExpression(expr)) {
        const c = condition(expr.condition, tails);
        return [
          ...expression(expr.whenTrue, c.yes),
          ...expression(expr.whenFalse, c.no),
        ];
      }
      if (
        ts.isBinaryExpression(expr) &&
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(expr.operatorToken.kind)
      ) {
        const id = add(
          expr.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
            ? code(expr.left) + " is not null"
            : code(expr.left),
          "decision",
          expr.left,
        );
        connect(tails, id);
        const yes = [{ from: id, label: "True" }],
          no = [{ from: id, label: "False" }];
        return expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
          ? [...expression(expr.right, yes), ...no]
          : [...yes, ...expression(expr.right, no)];
      }
      ts.forEachChild(expr, (child) => {
        tails = expression(child, tails);
      });
      return tails;
    }
    function transaction(expr: ts.Expression | undefined) {
      if (!expr) return;
      while (ts.isAwaitExpression(expr) || ts.isParenthesizedExpression(expr))
        expr = expr.expression;
      if (
        ts.isCallExpression(expr) &&
        ts.isPropertyAccessExpression(expr.expression) &&
        expr.expression.name.text === "transaction"
      ) {
        const fn = expr.arguments.find(
          (a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a),
        );
        if (
          fn &&
          (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) &&
          ts.isBlock(fn.body)
        )
          return fn.body;
      }
    }
    function block(
      statements: readonly ts.Statement[],
      tails: Tail[],
      returnTo = 2,
      errorTo = 2,
    ): Tail[] {
      for (const statement of statements) {
        if (!tails.length) break;
        if (ts.isIfStatement(statement)) {
          const c = condition(statement.expression, tails);
          const yes = block(
            ts.isBlock(statement.thenStatement)
              ? statement.thenStatement.statements
              : [statement.thenStatement],
            c.yes,
            returnTo,
            errorTo,
          );
          const no = statement.elseStatement
            ? block(
                ts.isBlock(statement.elseStatement)
                  ? statement.elseStatement.statements
                  : [statement.elseStatement],
                c.no,
                returnTo,
                errorTo,
              )
            : c.no;
          tails = [...yes, ...no];
          continue;
        }
        if (
          ts.isForOfStatement(statement) ||
          ts.isForInStatement(statement) ||
          ts.isWhileStatement(statement) ||
          ts.isForStatement(statement)
        ) {
          const label =
            ts.isForOfStatement(statement) || ts.isForInStatement(statement)
              ? "More items in " + code(statement.expression)
              : ts.isWhileStatement(statement)
                ? code(statement.expression)
                : statement.condition
                  ? code(statement.condition)
                  : "Continue loop";
          const id = add(label, "decision", statement);
          connect(tails, id);
          const body = ts.isBlock(statement.statement)
            ? statement.statement.statements
            : [statement.statement];
          const ends = block(
            body,
            [{ from: id, label: "True" }],
            returnTo,
            errorTo,
          );
          for (const t of ends)
            edges.push({ from: t.from, to: id, label: "Next" });
          tails = [{ from: id, label: "False" }];
          continue;
        }
        if (ts.isTryStatement(statement)) {
          const guard = add("I/O operation succeeds", "decision", statement);
          connect(tails, guard);
          const catchStart = add(
            "Handle I/O failure",
            "action",
            statement.catchClause,
          );
          edges.push({ from: guard, to: catchStart, label: "False" });
          const yes = block(
            statement.tryBlock.statements,
            [{ from: guard, label: "True" }],
            returnTo,
            catchStart,
          );
          const no = statement.catchClause
            ? block(
                statement.catchClause.block.statements,
                [{ from: catchStart, label: "" }],
                returnTo,
                errorTo,
              )
            : [];
          tails = [...yes, ...no];
          if (statement.finallyBlock)
            tails = block(
              statement.finallyBlock.statements,
              tails,
              returnTo,
              errorTo,
            );
          continue;
        }
        if (ts.isBlock(statement)) {
          tails = block(statement.statements, tails, returnTo, errorTo);
          continue;
        }
        if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) {
          const tx = ts.isReturnStatement(statement)
            ? transaction(statement.expression)
            : undefined;
          if (tx) {
            const begin = action("BEGIN transaction", tails, statement);
            const commit = add("COMMIT transaction", "action");
            const ends = block(tx.statements, begin, commit, errorTo);
            connect(ends, commit);
            edges.push({ from: commit, to: returnTo, label: "Return" });
          } else {
            const ends = statement.expression
              ? expression(statement.expression, tails)
              : tails;
            const terminal = action(
              (ts.isThrowStatement(statement) ? "RAISE " : "RETURN ") +
                (statement.expression ? code(statement.expression) : ""),
              ends,
              statement,
            );
            connect(
              terminal,
              ts.isThrowStatement(statement) ? errorTo : returnTo,
            );
          }
          tails = [];
          continue;
        }
        if (ts.isExpressionStatement(statement)) {
          const tx = transaction(statement.expression);
          if (tx) {
            const begin = action("BEGIN transaction", tails, statement);
            const commit = add("COMMIT transaction", "action");
            connect(block(tx.statements, begin, commit, errorTo), commit);
            tails = [{ from: commit, label: "" }];
            continue;
          }
        }
        tails = expression(statement, tails);
        tails = action(code(statement), tails, statement);
      }
      return tails;
    }
    connect(block(declaration.body.statements, [{ from: 1, label: "" }]), 2);
    const used = new Set([1, 2, ...edges.flatMap((e) => [e.from, e.to])]);
    const active = nodes.filter((n) => used.has(n.id));
    const unique = edges.filter(
      (e, i) =>
        edges.findIndex(
          (x) => x.from === e.from && x.to === e.to && x.label === e.label,
        ) === i,
    );
    const seenDirected = new Set<string>();
    for (let i = 0; i < unique.length; i++) {
      const e = unique[i],
        key = e.from + ":" + e.to;
      if (seenDirected.has(key)) {
        const target = e.to;
        const id = add(
          "Follow " + (e.label || "alternate") + " branch",
          "action",
        );
        active.push(nodes.at(-1)!);
        e.to = id;
        unique.push({ from: id, to: target, label: "" });
      } else seenDirected.add(key);
    }
    const predicates = active.filter(
      (n) => unique.filter((e) => e.from === n.id).length === 2,
    ).length;
    const complexity = unique.length - active.length + 2;
    const dot = `digraph ${name} { graph [label="${name}",labelloc=t,rankdir=TB,bgcolor="white"];node [fontname="Arial",fontsize=10,style=filled,fillcolor="#f5f7fb",color="#8c9bb4"];edge [fontname="Arial",fontsize=9,color="#63748d"];${active.map((n) => `n${n.id}[shape=${n.kind === "decision" ? "diamond" : n.kind === "end" ? "oval" : "box"},label=${JSON.stringify(n.id + ": " + n.label.replace(/(.{42})/g, "$1\n"))}];`).join("\n")}${unique.map((e) => `n${e.from}->n${e.to}[label=${JSON.stringify(e.label)}];`).join("\n")}}`;
    await writeFile(`docs/diagrams/cfg/${name}.dot`, dot);
    await writeFile(
      `docs/diagrams/cfg/${name}.svg`,
      viz.renderString(dot, { format: "svg" }),
    );
    const paths: number[][] = [];
    function dfs(node: number, path: number[], visits: Map<number, number>) {
      if (paths.length >= 5000 || path.length > active.length * 3) return;
      if (node === 2) {
        paths.push([...path, node]);
        return;
      }
      if ((visits.get(node) || 0) >= 2) return;
      const next = new Map(visits);
      next.set(node, (next.get(node) || 0) + 1);
      for (const e of unique.filter((e) => e.from === node))
        dfs(e.to, [...path, node], next);
    }
    dfs(1, [], new Map());
    const basis: number[][] = [];
    const pivots = new Map<number, bigint>();
    for (const p of paths) {
      let v = 0n;
      for (let i = 0; i < p.length - 1; i++) {
        const index = unique.findIndex(
          (e) => e.from === p[i] && e.to === p[i + 1],
        );
        v ^= 1n << BigInt(index);
      }
      for (const [k, row] of [...pivots.entries()].sort((a, b) => b[0] - a[0]))
        if ((v & (1n << BigInt(k))) !== 0n) v ^= row;
      if (v) {
        const pivot = v.toString(2).length - 1;
        pivots.set(pivot, v);
        basis.push(p);
        if (basis.length === complexity) break;
      }
    }
    graphs.push({
      name,
      file,
      line: sf.getLineAndCharacterOfPosition(declaration.getStart(sf)).line + 1,
      nodes: active,
      edges: unique,
      predicates,
      edgeNodeComplexity: complexity,
      predicateComplexity: predicates + 1,
      syntacticBasisCandidates: basis,
    });
    const instructions = active.map((n) => {
      const next = unique.filter((e) => e.from === n.id);
      if (n.id === 2) return "L2: END PROCEDURE";
      if (n.kind === "decision")
        return `L${n.id}: IF ${n.label}\n  THEN GO TO L${next.find((e) => e.label === "True")?.to}\n  ELSE GO TO L${next.find((e) => e.label === "False")?.to}`;
      return `L${n.id}: ${n.id === 1 ? "START " + name : n.label}\n  ${next.map((e) => "GO TO L" + e.to).join(" OR ")}`;
    });
    moduleText += `## ${name}\n\n${narratives[name]}\n\nSource: ${file}. Graph: [${name}](diagrams/cfg/${name}.svg).\n\nThe following labelled pseudocode follows graph edges. Labels are not execution order. A callback RETURN sets its result; the COMMIT step must succeed before the service returns that result. A raised error ends the transaction with rollback. Long source operations are abbreviated here; use the indexed source listing for their full arguments.\n\n\`\`\`text\n${instructions.join("\n")}\n\`\`\`\n\n`;
  }
}
await writeFile("docs/MODULES.md", moduleText);
await writeFile(
  "docs/evidence/control-flow.json",
  JSON.stringify(graphs, null, 2),
);
console.log(
  `Generated ${graphs.length} source-linked module graphs and processing narratives.`,
);

const diagrams: Record<string, string> = {
  use_case: `graph UseCases{graph[label="PracticeChart use cases",labelloc=t,rankdir=LR];node[fontname="Arial",fontsize=12];desk[shape=plaintext,label="Front desk"];doctor[shape=plaintext,label="Doctor"];subgraph cluster_system{label="PracticeChart EHR";node[shape=ellipse];login[label="Log in"];patient[label="Register and update patient"];schedule[label="Manage appointment"];file[label="File completed visit"];invoice[label="Create manual invoice"];clinical[label="Record and correct care"];lab[label="Store and retrieve lab report"];report[label="Print clinical patient report"];accounts[label="Manage staff access"];audit[label="View audit history"];}desk--login;desk--patient;desk--schedule;desk--file;desk--invoice;doctor--login;doctor--patient;doctor--schedule;doctor--file;doctor--invoice;doctor--clinical;doctor--lab;doctor--report;doctor--accounts;doctor--audit;}`,
  sequence: `digraph Sequence{graph[label="Appointment confirmation sequence",labelloc=t,rankdir=LR];node[shape=box,fontname="Arial",style=filled,fillcolor="#f3f6fa"];user[label="1 Front desk\nSelect patient and time"];ui[label="2 Booking form\nCheck availability\nShow review"];api[label="3 Server\nAuthenticate and validate"];db[label="4 PostgreSQL transaction\nCheck hours and exclusions\nInsert booking and audit"];response[label="5 Return committed result\nShow confirmation or conflict"];user->ui[label="request"];ui->api[label="confirm"];api->db[label="transaction"];db->response[label="commit or rollback"];response->user[label="result"];}`,
  swimlane: `digraph Swimlane{graph[label="Visit workflow by role",labelloc=t,rankdir=LR];node[shape=box,fontname="Arial"];subgraph cluster_desk{label="Front desk";register[label="Register or find patient"];arrival[label="Mark arrival and start visit"];file[label="File ready visit"];invoice[label="Create invoice or attendance slip"];}subgraph cluster_doctor{label="Doctor";review[label="Review patient history"];record[label="Enter notes, diagnosis, and treatment"];final[label="Save final clinical revision"];}subgraph cluster_system{label="System and PostgreSQL";guard[label="Require final diagnosis"];log[label="Commit filed state and audit"];}register->arrival;arrival->review;review->record;record->final;final->guard;guard->file[label="ready state only"];file->log;log->invoice;}`,
  data: `digraph Data{graph[label="PracticeChart data relationships",labelloc=t,rankdir=LR];node[shape=record,fontname="Arial",fontsize=11];users[label="users|id PK|username UNIQUE|role and password hash"];patients[label="patients|id PK|mrn UNIQUE|demographics and version"];appointments[label="appointments|id PK|patient_id FK|doctor_id FK|start_at and end_at|overlap exclusions"];visits[label="visits|id PK|patient_id FK|doctor_id FK|appointment_id FK UNIQUE|revision and status"];revisions[label="clinical_revisions|id PK|visit_id FK|author_id FK|revision UNIQUE per visit|content JSONB and state"];prescriptions[label="prescriptions|revision_id FK|visit_id FK|patient_id FK|doctor-entered content"];documents[label="documents|id PK|patient_id FK|replaces_id FK|private path and SHA256"];invoices[label="invoices|id PK|number UNIQUE|patient_id FK|lines and integer cents"];audit[label="audit_events|id PK|actor_id FK|action and record reference"];sessions[label="sessions|token hash PK|user_id FK|expiry"];users->sessions[label="1 to many"];patients->appointments[label="1 to many"];users->appointments[label="doctor"];patients->visits[label="1 to many"];appointments->visits[label="0 or 1"];users->visits[label="doctor"];visits->revisions[label="1 to many"];revisions->prescriptions[label="0 to many"];patients->documents[label="1 to many"];patients->invoices[label="1 to many"];users->audit[label="actor"];}`,
  class: `digraph Classes{graph[label="Application domain classes and services",labelloc=t,rankdir=LR];node[shape=record,fontname="Arial"];User[label="Staff|id, role, active|requireRole()\ngetSession()"];Patient[label="Patient|id, mrn, demographics, version|savePatient()\narchivePatient()\nreconcilePatient()"];Appointment[label="Appointment|doctor, patient, interval, status|availability()\nbookAppointment()\nappointmentStatus()"];Visit[label="Visit|patient, doctor, revision, state|startVisit()\nsaveClinical()\nfileVisit()"];Clinical[label="Clinical revision|content, author, reason, state|append only"];Document[label="Diagnostic document|patient, path, digest|storeFile()\nreadPrivateFile()"];Invoice[label="Invoice|lines, total cents, status|saveInvoice()\nsetInvoiceStatus()"];User->Patient[label="uses"];User->Appointment[label="uses"];Patient->Visit[label="has"];Appointment->Visit[label="may start"];Visit->Clinical[label="has revisions"];Patient->Document[label="has"];Patient->Invoice[label="has"];}`,
  ipo: `digraph Modules{graph[label="Input processing and output modules",labelloc=t,rankdir=TB];node[shape=box,fontname="Arial",style=filled,fillcolor="#f3f6fa"];ehr[label="PracticeChart EHR"];input[label="INPUT"];process[label="PROCESSING"];output[label="OUTPUT"];ehr->{input process output};credentials[label="User credentials"];demographics[label="Patient demographics"];requests[label="Appointment requests"];files[label="Diagnostic files"];clinicalInput[label="Doctor clinical entries"];input->{credentials demographics requests files clinicalInput};auth[label="Authentication and role checks"];patient[label="Patient management"];appointment[label="Appointment transactions"];care[label="Clinical revisions and filing"];billing[label="Invoice calculation"];recovery[label="Backup and recovery"];process->{auth patient appointment care billing recovery};docs[label="Clinical documents and patient history"];admin[label="Schedules, attendance, and invoices"];audit[label="Audit history and recovery evidence"];output->{docs admin audit};}`,
  dfd: `digraph DFD{graph[label="Level 1 data flow",labelloc=t,rankdir=LR];node[shape=box,fontname="Arial"];staff[label="Staff"];auth[label="1 Authenticate",shape=ellipse];patient[label="2 Manage patient",shape=ellipse];booking[label="3 Manage appointment",shape=ellipse];care[label="4 Record and retrieve care",shape=ellipse];report[label="5 Produce report",shape=ellipse];database[label="EHR PostgreSQL",shape=cylinder];blob[label="Private diagnostic storage",shape=cylinder];staff->auth[label="credentials"];auth->patient[label="server identity"];auth->booking[label="server identity"];auth->care[label="doctor identity"];patient->database[label="demographics"];booking->database[label="booking and audit"];care->database[label="clinical revisions"];care->blob[label="private document bytes"];database->report[label="authorised records"];blob->report[label="authorised document"];report->staff[label="reading or print output"];}`,
};
for (const [name, dot] of Object.entries(diagrams)) {
  await writeFile(`docs/diagrams/${name}.dot`, dot);
  await writeFile(
    `docs/diagrams/${name}.svg`,
    viz.renderString(dot, { format: "svg" }),
  );
}
console.log(
  "Generated use case, sequence, swimlane, data, class, module, and data flow diagrams.",
);
