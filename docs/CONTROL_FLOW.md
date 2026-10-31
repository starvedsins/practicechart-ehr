# Control flow and basis path analysis

The generator reads the implemented TypeScript functions. It expands transaction callbacks. It does not expand database engines or library internals. SQL constraints have separate integration tests. Graphs use one entry and one exit. Compound conditions are split. Each explicit I/O try block has one fault branch.

Face counts use a planar half-edge traversal. Parallel directed edges add a lens face. Predicate counts are taken from nodes with two outgoing edges. The third method uses the separate edge and node counts. These three results must agree.

| Function | Nodes N | Edges E | Faces R | Predicates P | R | P + 1 | E - N + 2 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| patientList | 7 | 6 | 1 | 0 | 1 | 1 | 1 |
| patientDetail | 14 | 14 | 2 | 1 | 2 | 2 | 2 |
| savePatient | 17 | 18 | 3 | 2 | 3 | 3 | 3 |
| archivePatient | 13 | 14 | 3 | 2 | 3 | 3 | 3 |
| reconcilePatient | 21 | 25 | 6 | 5 | 6 | 6 | 6 |
| schedule | 10 | 11 | 3 | 2 | 3 | 3 | 3 |
| availability | 7 | 7 | 2 | 1 | 2 | 2 | 2 |
| bookAppointment | 20 | 23 | 5 | 4 | 5 | 5 | 5 |
| appointmentStatus | 10 | 10 | 2 | 1 | 2 | 2 | 2 |
| startVisit | 19 | 23 | 6 | 5 | 6 | 6 | 6 |
| saveClinical | 29 | 37 | 10 | 9 | 10 | 10 | 10 |
| fileVisit | 17 | 21 | 6 | 5 | 6 | 6 | 6 |
| saveInvoice | 10 | 9 | 1 | 0 | 1 | 1 | 1 |
| setInvoiceStatus | 15 | 18 | 5 | 4 | 5 | 5 | 5 |
| invoiceList | 4 | 3 | 1 | 0 | 1 | 1 | 1 |
| manageUser | 33 | 40 | 9 | 8 | 9 | 9 | 9 |
| changePassword | 17 | 19 | 4 | 3 | 4 | 4 | 4 |
| dashboard | 9 | 8 | 1 | 0 | 1 | 1 | 1 |
| reportData | 24 | 31 | 9 | 8 | 9 | 9 | 9 |
| requireRole | 5 | 5 | 2 | 1 | 2 | 2 | 2 |
| getSession | 8 | 9 | 3 | 2 | 3 | 3 | 3 |
| login | 23 | 27 | 6 | 5 | 6 | 6 | 6 |
| storeFile | 23 | 31 | 10 | 9 | 10 | 10 | 10 |
| readPrivateFile | 16 | 21 | 7 | 6 | 7 | 7 | 7 |
| invoiceTotal | 7 | 8 | 3 | 2 | 3 | 3 | 3 |
| fileMime | 11 | 15 | 6 | 5 | 6 | 6 | 6 |

## Basis path candidates

The following paths are independent in the generated graph. They are syntactic candidates, not a claim that every candidate is feasible or was executed. Branch conditions can depend on earlier state. For example, a stale revision cannot also reach a successful save in the same execution. Repeated file and medication paths depend on the number of records. Do not invent inputs to force an impossible path.

Actual feasible scenarios and test outcomes are mapped in TEST_PLAN.md. Full possible-path coverage is not claimed. V8 statement and branch coverage is recorded separately. A loop can have more possible executions than its basis-path count.

### patientList

Source: src/lib/service.ts:46. [Graph](diagrams/cfg/patientList.svg).

- Candidate 1: 1 -> 3 -> 4 -> 6 -> 7 -> 5 -> 2

Face boundaries: 1 -> 3 -> 4 -> 6 -> 7 -> 5 -> 2 -> 5 -> 7 -> 6 -> 4 -> 3. Additional parallel-edge lens faces: 0.

### patientDetail

Source: src/lib/service.ts:56. [Graph](diagrams/cfg/patientDetail.svg).

- Candidate 1: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 5 -> 2
- Candidate 2: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 9 -> 10 -> 12 -> 13 -> 14 -> 5 -> 2

Face boundaries: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 9 -> 10 -> 12 -> 13 -> 14 -> 5 -> 11 -> 10 -> 9 -> 8 -> 7 -> 6 -> 4 -> 3; 2 -> 5 -> 14 -> 13 -> 12 -> 10 -> 11 -> 5. Additional parallel-edge lens faces: 0.

### savePatient

Source: src/lib/service.ts:98. [Graph](diagrams/cfg/savePatient.svg).

- Candidate 1: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 2
- Candidate 2: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 9 -> 10 -> 12 -> 13 -> 5 -> 2
- Candidate 3: 1 -> 3 -> 4 -> 6 -> 14 -> 15 -> 16 -> 17 -> 5 -> 2

Face boundaries: 1 -> 3 -> 4 -> 6 -> 14 -> 15 -> 16 -> 17 -> 5 -> 2 -> 11 -> 10 -> 9 -> 8 -> 7 -> 6 -> 4 -> 3; 2 -> 5 -> 13 -> 12 -> 10 -> 11; 5 -> 17 -> 16 -> 15 -> 14 -> 6 -> 7 -> 8 -> 9 -> 10 -> 12 -> 13. Additional parallel-edge lens faces: 0.

### archivePatient

Source: src/lib/service.ts:131. [Graph](diagrams/cfg/archivePatient.svg).

- Candidate 1: 1 -> 3 -> 4 -> 5 -> 7 -> 8 -> 9 -> 2
- Candidate 2: 1 -> 3 -> 4 -> 5 -> 7 -> 8 -> 10 -> 11 -> 12 -> 6 -> 2
- Candidate 3: 1 -> 3 -> 4 -> 5 -> 7 -> 8 -> 10 -> 13 -> 11 -> 12 -> 6 -> 2

Face boundaries: 1 -> 3 -> 4 -> 5 -> 7 -> 8 -> 10 -> 11 -> 12 -> 6 -> 2 -> 9 -> 8 -> 7 -> 5 -> 4 -> 3; 2 -> 6 -> 12 -> 11 -> 13 -> 10 -> 8 -> 9; 10 -> 13 -> 11. Additional parallel-edge lens faces: 0.

### reconcilePatient

Source: src/lib/service.ts:149. [Graph](diagrams/cfg/reconcilePatient.svg).

- Candidate 1: 1 -> 3 -> 4 -> 5 -> 6 -> 7 -> 2
- Candidate 2: 1 -> 3 -> 4 -> 5 -> 6 -> 8 -> 10 -> 11 -> 12 -> 2
- Candidate 3: 1 -> 3 -> 4 -> 5 -> 6 -> 8 -> 10 -> 11 -> 13 -> 14 -> 15 -> 16 -> 17 -> 18 -> 2
- Candidate 4: 1 -> 3 -> 4 -> 5 -> 6 -> 8 -> 10 -> 11 -> 13 -> 14 -> 15 -> 16 -> 17 -> 19 -> 20 -> 21 -> 9 -> 2
- Candidate 5: 1 -> 3 -> 4 -> 5 -> 6 -> 8 -> 10 -> 11 -> 13 -> 14 -> 15 -> 16 -> 18 -> 2
- Candidate 6: 1 -> 3 -> 4 -> 5 -> 6 -> 8 -> 10 -> 11 -> 13 -> 14 -> 15 -> 18 -> 2

Face boundaries: 1 -> 3 -> 4 -> 5 -> 6 -> 8 -> 10 -> 11 -> 12 -> 2 -> 7 -> 6 -> 5 -> 4 -> 3; 2 -> 12 -> 11 -> 13 -> 14 -> 15 -> 18; 2 -> 9 -> 21 -> 20 -> 19 -> 17 -> 16 -> 15 -> 14 -> 13 -> 11 -> 10 -> 8 -> 6 -> 7; 2 -> 18 -> 17 -> 19 -> 20 -> 21 -> 9; 15 -> 16 -> 18; 16 -> 17 -> 18. Additional parallel-edge lens faces: 0.

### schedule

Source: src/lib/service.ts:189. [Graph](diagrams/cfg/schedule.svg).

- Candidate 1: 1 -> 3 -> 4 -> 5 -> 6 -> 8 -> 9 -> 7 -> 2
- Candidate 2: 1 -> 3 -> 4 -> 10 -> 5 -> 6 -> 8 -> 9 -> 7 -> 2
- Candidate 3: 1 -> 3 -> 5 -> 6 -> 8 -> 9 -> 7 -> 2

Face boundaries: 1 -> 3 -> 5 -> 4 -> 3; 2 -> 7 -> 9 -> 8 -> 6 -> 5 -> 10 -> 4 -> 5 -> 6 -> 8 -> 9 -> 7; 3 -> 4 -> 10 -> 5. Additional parallel-edge lens faces: 0.

### availability

Source: src/lib/service.ts:204. [Graph](diagrams/cfg/availability.svg).

- Candidate 1: 1 -> 3 -> 4 -> 5 -> 2
- Candidate 2: 1 -> 3 -> 4 -> 6 -> 7 -> 2

Face boundaries: 1 -> 3 -> 4 -> 6 -> 7 -> 2 -> 5 -> 4 -> 3; 2 -> 7 -> 6 -> 4 -> 5. Additional parallel-edge lens faces: 0.

### bookAppointment

Source: src/lib/service.ts:217. [Graph](diagrams/cfg/bookAppointment.svg).

- Candidate 1: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 9 -> 2
- Candidate 2: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 10 -> 11 -> 12 -> 13 -> 14 -> 15 -> 2
- Candidate 3: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 10 -> 11 -> 12 -> 13 -> 14 -> 16 -> 17 -> 5 -> 2
- Candidate 4: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 10 -> 18 -> 19 -> 20 -> 5 -> 2
- Candidate 5: 1 -> 3 -> 4 -> 6 -> 7 -> 9 -> 2

Face boundaries: 1 -> 3 -> 4 -> 6 -> 7 -> 9 -> 8 -> 7 -> 6 -> 4 -> 3; 2 -> 15 -> 14 -> 16 -> 17 -> 5; 2 -> 5 -> 20 -> 19 -> 18 -> 10 -> 8 -> 9; 2 -> 9 -> 7 -> 8 -> 10 -> 11 -> 12 -> 13 -> 14 -> 15; 5 -> 17 -> 16 -> 14 -> 13 -> 12 -> 11 -> 10 -> 18 -> 19 -> 20. Additional parallel-edge lens faces: 0.

### appointmentStatus

Source: src/lib/service.ts:270. [Graph](diagrams/cfg/appointmentStatus.svg).

- Candidate 1: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 2
- Candidate 2: 1 -> 3 -> 4 -> 6 -> 7 -> 9 -> 10 -> 5 -> 2

Face boundaries: 1 -> 3 -> 4 -> 6 -> 7 -> 9 -> 10 -> 5 -> 2 -> 8 -> 7 -> 6 -> 4 -> 3; 2 -> 5 -> 10 -> 9 -> 7 -> 8. Additional parallel-edge lens faces: 0.

### startVisit

Source: src/lib/service.ts:302. [Graph](diagrams/cfg/startVisit.svg).

- Candidate 1: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 2
- Candidate 2: 1 -> 3 -> 4 -> 6 -> 7 -> 9 -> 10 -> 11 -> 12 -> 13 -> 14 -> 15 -> 2
- Candidate 3: 1 -> 3 -> 4 -> 6 -> 7 -> 9 -> 10 -> 11 -> 12 -> 13 -> 14 -> 16 -> 17 -> 18 -> 19 -> 5 -> 2
- Candidate 4: 1 -> 3 -> 4 -> 6 -> 7 -> 9 -> 10 -> 11 -> 12 -> 13 -> 15 -> 2
- Candidate 5: 1 -> 3 -> 4 -> 6 -> 7 -> 9 -> 10 -> 11 -> 12 -> 15 -> 2
- Candidate 6: 1 -> 3 -> 4 -> 6 -> 7 -> 9 -> 10 -> 17 -> 18 -> 19 -> 5 -> 2

Face boundaries: 1 -> 3 -> 4 -> 6 -> 7 -> 9 -> 10 -> 11 -> 12 -> 15 -> 2 -> 8 -> 7 -> 6 -> 4 -> 3; 2 -> 15 -> 14 -> 16 -> 17 -> 18 -> 19 -> 5; 2 -> 5 -> 19 -> 18 -> 17 -> 10 -> 9 -> 7 -> 8; 10 -> 17 -> 16 -> 14 -> 13 -> 12 -> 11; 12 -> 13 -> 15; 13 -> 14 -> 15. Additional parallel-edge lens faces: 0.

### saveClinical

Source: src/lib/service.ts:348. [Graph](diagrams/cfg/saveClinical.svg).

- Candidate 1: 1 -> 3 -> 4 -> 5 -> 6 -> 8 -> 9 -> 10 -> 2
- Candidate 2: 1 -> 3 -> 4 -> 5 -> 6 -> 8 -> 9 -> 11 -> 12 -> 13 -> 14 -> 15 -> 2
- Candidate 3: 1 -> 3 -> 4 -> 5 -> 6 -> 8 -> 9 -> 11 -> 12 -> 13 -> 14 -> 16 -> 17 -> 18 -> 19 -> 20 -> 21 -> 22 -> 23 -> 24 -> 23 -> 25 -> 26 -> 27 -> 7 -> 2
- Candidate 4: 1 -> 3 -> 4 -> 5 -> 6 -> 8 -> 9 -> 11 -> 12 -> 13 -> 14 -> 16 -> 17 -> 18 -> 19 -> 20 -> 21 -> 22 -> 23 -> 24 -> 23 -> 25 -> 29 -> 26 -> 27 -> 7 -> 2
- Candidate 5: 1 -> 3 -> 4 -> 5 -> 6 -> 8 -> 9 -> 11 -> 12 -> 13 -> 14 -> 16 -> 17 -> 18 -> 19 -> 20 -> 21 -> 22 -> 23 -> 25 -> 26 -> 27 -> 7 -> 2
- Candidate 6: 1 -> 3 -> 4 -> 5 -> 6 -> 8 -> 9 -> 11 -> 12 -> 13 -> 14 -> 16 -> 17 -> 18 -> 19 -> 20 -> 21 -> 22 -> 25 -> 26 -> 27 -> 7 -> 2
- Candidate 7: 1 -> 3 -> 4 -> 5 -> 6 -> 8 -> 9 -> 11 -> 12 -> 13 -> 14 -> 16 -> 17 -> 18 -> 19 -> 20 -> 28 -> 21 -> 22 -> 23 -> 24 -> 23 -> 25 -> 26 -> 27 -> 7 -> 2
- Candidate 8: 1 -> 3 -> 4 -> 5 -> 6 -> 8 -> 9 -> 11 -> 12 -> 13 -> 14 -> 16 -> 17 -> 18 -> 19 -> 21 -> 22 -> 23 -> 24 -> 23 -> 25 -> 26 -> 27 -> 7 -> 2
- Candidate 9: 1 -> 3 -> 4 -> 5 -> 6 -> 8 -> 9 -> 11 -> 12 -> 13 -> 15 -> 2
- Candidate 10: 1 -> 3 -> 4 -> 5 -> 6 -> 8 -> 9 -> 11 -> 12 -> 16 -> 17 -> 18 -> 19 -> 20 -> 21 -> 22 -> 23 -> 24 -> 23 -> 25 -> 26 -> 27 -> 7 -> 2

Face boundaries: 1 -> 3 -> 4 -> 5 -> 6 -> 8 -> 9 -> 11 -> 12 -> 13 -> 15 -> 2 -> 10 -> 9 -> 8 -> 6 -> 5 -> 4 -> 3; 2 -> 15 -> 14 -> 16 -> 17 -> 18 -> 19 -> 21 -> 22 -> 25 -> 29 -> 26 -> 27 -> 7; 2 -> 7 -> 27 -> 26 -> 25 -> 23 -> 22 -> 21 -> 20 -> 19 -> 18 -> 17 -> 16 -> 12 -> 11 -> 9 -> 10; 12 -> 16 -> 14 -> 13; 13 -> 14 -> 15; 19 -> 20 -> 28 -> 21; 20 -> 21 -> 28; 22 -> 23 -> 24 -> 23 -> 25; 25 -> 26 -> 29. Additional parallel-edge lens faces: 1.

### fileVisit

Source: src/lib/service.ts:410. [Graph](diagrams/cfg/fileVisit.svg).

- Candidate 1: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12 -> 2
- Candidate 2: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 13 -> 14 -> 15 -> 16 -> 17 -> 5 -> 2
- Candidate 3: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 13 -> 14 -> 16 -> 17 -> 5 -> 2
- Candidate 4: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 9 -> 10 -> 12 -> 2
- Candidate 5: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 9 -> 12 -> 2
- Candidate 6: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 12 -> 2

Face boundaries: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 12 -> 11 -> 10 -> 9 -> 8 -> 7 -> 6 -> 4 -> 3; 2 -> 5 -> 17 -> 16 -> 15 -> 14 -> 13 -> 11 -> 12; 2 -> 12 -> 10 -> 11 -> 13 -> 14 -> 16 -> 17 -> 5; 8 -> 9 -> 12; 9 -> 10 -> 12; 14 -> 15 -> 16. Additional parallel-edge lens faces: 0.

### saveInvoice

Source: src/lib/service.ts:447. [Graph](diagrams/cfg/saveInvoice.svg).

- Candidate 1: 1 -> 3 -> 4 -> 5 -> 7 -> 8 -> 9 -> 10 -> 6 -> 2

Face boundaries: 1 -> 3 -> 4 -> 5 -> 7 -> 8 -> 9 -> 10 -> 6 -> 2 -> 6 -> 10 -> 9 -> 8 -> 7 -> 5 -> 4 -> 3. Additional parallel-edge lens faces: 0.

### setInvoiceStatus

Source: src/lib/service.ts:465. [Graph](diagrams/cfg/setInvoiceStatus.svg).

- Candidate 1: 1 -> 3 -> 4 -> 5 -> 6 -> 2
- Candidate 2: 1 -> 3 -> 4 -> 5 -> 7 -> 9 -> 10 -> 11 -> 12 -> 2
- Candidate 3: 1 -> 3 -> 4 -> 5 -> 7 -> 9 -> 10 -> 11 -> 13 -> 14 -> 8 -> 2
- Candidate 4: 1 -> 3 -> 4 -> 5 -> 7 -> 9 -> 15 -> 10 -> 11 -> 12 -> 2
- Candidate 5: 1 -> 3 -> 4 -> 7 -> 9 -> 10 -> 11 -> 12 -> 2

Face boundaries: 1 -> 3 -> 4 -> 7 -> 9 -> 10 -> 11 -> 12 -> 2 -> 6 -> 5 -> 4 -> 3; 2 -> 12 -> 11 -> 13 -> 14 -> 8; 2 -> 8 -> 14 -> 13 -> 11 -> 10 -> 15 -> 9 -> 7 -> 5 -> 6; 4 -> 5 -> 7; 9 -> 15 -> 10. Additional parallel-edge lens faces: 0.

### invoiceList

Source: src/lib/service.ts:500. [Graph](diagrams/cfg/invoiceList.svg).

- Candidate 1: 1 -> 3 -> 4 -> 2

Face boundaries: 1 -> 3 -> 4 -> 2 -> 4 -> 3. Additional parallel-edge lens faces: 0.

### manageUser

Source: src/lib/service.ts:506. [Graph](diagrams/cfg/manageUser.svg).

- Candidate 1: 1 -> 3 -> 4 -> 5 -> 6 -> 7 -> 9 -> 10 -> 11 -> 12 -> 13 -> 8 -> 2
- Candidate 2: 1 -> 3 -> 4 -> 5 -> 6 -> 7 -> 9 -> 10 -> 12 -> 13 -> 8 -> 2
- Candidate 3: 1 -> 3 -> 4 -> 14 -> 15 -> 16 -> 17 -> 19 -> 20 -> 21 -> 22 -> 2
- Candidate 4: 1 -> 3 -> 4 -> 14 -> 15 -> 16 -> 17 -> 19 -> 20 -> 21 -> 23 -> 24 -> 25 -> 26 -> 2
- Candidate 5: 1 -> 3 -> 4 -> 14 -> 15 -> 16 -> 17 -> 19 -> 20 -> 21 -> 23 -> 24 -> 25 -> 27 -> 28 -> 29 -> 30 -> 31 -> 18 -> 2
- Candidate 6: 1 -> 3 -> 4 -> 14 -> 15 -> 16 -> 17 -> 19 -> 20 -> 21 -> 23 -> 24 -> 25 -> 27 -> 29 -> 30 -> 31 -> 18 -> 2
- Candidate 7: 1 -> 3 -> 4 -> 14 -> 15 -> 16 -> 17 -> 19 -> 20 -> 21 -> 23 -> 33 -> 24 -> 25 -> 26 -> 2
- Candidate 8: 1 -> 3 -> 4 -> 14 -> 15 -> 16 -> 17 -> 19 -> 20 -> 23 -> 24 -> 25 -> 26 -> 2
- Candidate 9: 1 -> 3 -> 4 -> 14 -> 15 -> 32 -> 16 -> 17 -> 19 -> 20 -> 21 -> 22 -> 2

Face boundaries: 1 -> 3 -> 4 -> 14 -> 15 -> 16 -> 17 -> 19 -> 20 -> 21 -> 22 -> 2 -> 8 -> 13 -> 12 -> 11 -> 10 -> 9 -> 7 -> 6 -> 5 -> 4 -> 3; 2 -> 22 -> 21 -> 23 -> 33 -> 24 -> 25 -> 27 -> 29 -> 30 -> 31 -> 18; 2 -> 26 -> 25 -> 24 -> 23 -> 20 -> 19 -> 17 -> 16 -> 32 -> 15 -> 14 -> 4 -> 5 -> 6 -> 7 -> 9 -> 10 -> 12 -> 13 -> 8; 2 -> 18 -> 31 -> 30 -> 29 -> 28 -> 27 -> 25 -> 26; 10 -> 11 -> 12; 15 -> 32 -> 16; 20 -> 23 -> 21; 23 -> 24 -> 33; 27 -> 28 -> 29. Additional parallel-edge lens faces: 0.

### changePassword

Source: src/lib/service.ts:567. [Graph](diagrams/cfg/changePassword.svg).

- Candidate 1: 1 -> 3 -> 4 -> 5 -> 6 -> 2
- Candidate 2: 1 -> 3 -> 4 -> 5 -> 7 -> 8 -> 9 -> 10 -> 2
- Candidate 3: 1 -> 3 -> 4 -> 5 -> 7 -> 8 -> 9 -> 11 -> 12 -> 14 -> 15 -> 16 -> 13 -> 17 -> 2
- Candidate 4: 1 -> 3 -> 4 -> 7 -> 8 -> 9 -> 10 -> 2

Face boundaries: 1 -> 3 -> 4 -> 7 -> 8 -> 9 -> 10 -> 2 -> 6 -> 5 -> 4 -> 3; 2 -> 10 -> 9 -> 11 -> 12 -> 14 -> 15 -> 16 -> 13 -> 17; 2 -> 17 -> 13 -> 16 -> 15 -> 14 -> 12 -> 11 -> 9 -> 8 -> 7 -> 5 -> 6; 4 -> 5 -> 7. Additional parallel-edge lens faces: 0.

### dashboard

Source: src/lib/service.ts:591. [Graph](diagrams/cfg/dashboard.svg).

- Candidate 1: 1 -> 3 -> 5 -> 6 -> 7 -> 8 -> 9 -> 4 -> 2

Face boundaries: 1 -> 3 -> 5 -> 6 -> 7 -> 8 -> 9 -> 4 -> 2 -> 4 -> 9 -> 8 -> 7 -> 6 -> 5 -> 3. Additional parallel-edge lens faces: 0.

### reportData

Source: src/lib/service.ts:609. [Graph](diagrams/cfg/reportData.svg).

- Candidate 1: 1 -> 3 -> 4 -> 2
- Candidate 2: 1 -> 3 -> 5 -> 6 -> 7 -> 8 -> 2
- Candidate 3: 1 -> 3 -> 5 -> 6 -> 7 -> 9 -> 10 -> 11 -> 2
- Candidate 4: 1 -> 3 -> 5 -> 6 -> 7 -> 9 -> 12 -> 13 -> 14 -> 15 -> 2
- Candidate 5: 1 -> 3 -> 5 -> 6 -> 7 -> 9 -> 12 -> 13 -> 14 -> 16 -> 17 -> 2
- Candidate 6: 1 -> 3 -> 5 -> 6 -> 7 -> 9 -> 12 -> 13 -> 14 -> 16 -> 18 -> 19 -> 20 -> 2
- Candidate 7: 1 -> 3 -> 5 -> 6 -> 7 -> 9 -> 12 -> 13 -> 14 -> 16 -> 18 -> 19 -> 21 -> 22 -> 23 -> 2
- Candidate 8: 1 -> 3 -> 5 -> 6 -> 7 -> 9 -> 12 -> 13 -> 14 -> 16 -> 18 -> 19 -> 21 -> 22 -> 24 -> 2
- Candidate 9: 1 -> 3 -> 5 -> 7 -> 8 -> 2

Face boundaries: 1 -> 3 -> 5 -> 7 -> 8 -> 2 -> 4 -> 3; 2 -> 8 -> 7 -> 9 -> 12 -> 13 -> 14 -> 16 -> 18 -> 19 -> 21 -> 22 -> 24; 2 -> 11 -> 10 -> 9 -> 7 -> 6 -> 5 -> 3 -> 4; 2 -> 15 -> 14 -> 13 -> 12 -> 9 -> 10 -> 11; 2 -> 17 -> 16 -> 14 -> 15; 2 -> 20 -> 19 -> 18 -> 16 -> 17; 2 -> 23 -> 22 -> 21 -> 19 -> 20; 2 -> 24 -> 22 -> 23; 5 -> 6 -> 7. Additional parallel-edge lens faces: 0.

### requireRole

Source: src/lib/auth.ts:24. [Graph](diagrams/cfg/requireRole.svg).

- Candidate 1: 1 -> 3 -> 4 -> 5 -> 2
- Candidate 2: 1 -> 3 -> 2

Face boundaries: 1 -> 3 -> 4 -> 5 -> 2 -> 3; 2 -> 5 -> 4 -> 3. Additional parallel-edge lens faces: 0.

### getSession

Source: src/lib/auth.ts:30. [Graph](diagrams/cfg/getSession.svg).

- Candidate 1: 1 -> 3 -> 4 -> 2
- Candidate 2: 1 -> 3 -> 5 -> 6 -> 7 -> 2
- Candidate 3: 1 -> 3 -> 5 -> 6 -> 8 -> 7 -> 2

Face boundaries: 1 -> 3 -> 5 -> 6 -> 7 -> 2 -> 4 -> 3; 2 -> 7 -> 8 -> 6 -> 5 -> 3 -> 4; 6 -> 8 -> 7. Additional parallel-edge lens faces: 0.

### login

Source: src/lib/auth.ts:54. [Graph](diagrams/cfg/login.svg).

- Candidate 1: 1 -> 3 -> 4 -> 5 -> 6 -> 2
- Candidate 2: 1 -> 3 -> 4 -> 5 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12 -> 13 -> 14 -> 15 -> 2
- Candidate 3: 1 -> 3 -> 4 -> 5 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12 -> 13 -> 16 -> 17 -> 19 -> 20 -> 21 -> 18 -> 22 -> 2
- Candidate 4: 1 -> 3 -> 4 -> 5 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12 -> 14 -> 15 -> 2
- Candidate 5: 1 -> 3 -> 4 -> 5 -> 7 -> 8 -> 9 -> 10 -> 11 -> 14 -> 15 -> 2
- Candidate 6: 1 -> 3 -> 4 -> 5 -> 7 -> 8 -> 9 -> 23 -> 10 -> 11 -> 12 -> 13 -> 14 -> 15 -> 2

Face boundaries: 1 -> 3 -> 4 -> 5 -> 7 -> 8 -> 9 -> 10 -> 11 -> 14 -> 15 -> 2 -> 6 -> 5 -> 4 -> 3; 2 -> 15 -> 14 -> 13 -> 16 -> 17 -> 19 -> 20 -> 21 -> 18 -> 22; 2 -> 22 -> 18 -> 21 -> 20 -> 19 -> 17 -> 16 -> 13 -> 12 -> 11 -> 10 -> 23 -> 9 -> 8 -> 7 -> 5 -> 6; 9 -> 23 -> 10; 11 -> 12 -> 14; 12 -> 13 -> 14. Additional parallel-edge lens faces: 0.

### storeFile

Source: src/lib/storage.ts:31. [Graph](diagrams/cfg/storeFile.svg).

- Candidate 1: 1 -> 3 -> 4 -> 5 -> 2
- Candidate 2: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 9 -> 2
- Candidate 3: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 10 -> 11 -> 12 -> 2
- Candidate 4: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 10 -> 11 -> 13 -> 14 -> 15 -> 16 -> 21 -> 2
- Candidate 5: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 10 -> 11 -> 13 -> 14 -> 15 -> 17 -> 18 -> 19 -> 20 -> 21 -> 2
- Candidate 6: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 10 -> 11 -> 13 -> 14 -> 15 -> 17 -> 23 -> 18 -> 19 -> 20 -> 21 -> 2
- Candidate 7: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 10 -> 11 -> 13 -> 22 -> 14 -> 15 -> 16 -> 21 -> 2
- Candidate 8: 1 -> 3 -> 4 -> 6 -> 7 -> 8 -> 10 -> 13 -> 14 -> 15 -> 16 -> 21 -> 2
- Candidate 9: 1 -> 3 -> 4 -> 6 -> 7 -> 9 -> 2
- Candidate 10: 1 -> 3 -> 5 -> 2

Face boundaries: 1 -> 3 -> 5 -> 4 -> 3; 2 -> 9 -> 8 -> 10 -> 13 -> 22 -> 14 -> 15 -> 17 -> 18 -> 19 -> 20 -> 21; 2 -> 12 -> 11 -> 10 -> 8 -> 7 -> 6 -> 4 -> 5; 2 -> 21 -> 16 -> 15 -> 14 -> 13 -> 11 -> 12; 2 -> 5 -> 3 -> 4 -> 6 -> 7 -> 9; 7 -> 8 -> 9; 10 -> 11 -> 13; 13 -> 14 -> 22; 15 -> 16 -> 21 -> 20 -> 19 -> 18 -> 23 -> 17; 17 -> 23 -> 18. Additional parallel-edge lens faces: 0.

### readPrivateFile

Source: src/lib/storage.ts:67. [Graph](diagrams/cfg/readPrivateFile.svg).

- Candidate 1: 1 -> 3 -> 4 -> 2
- Candidate 2: 1 -> 3 -> 5 -> 6 -> 15 -> 2
- Candidate 3: 1 -> 3 -> 5 -> 7 -> 8 -> 9 -> 10 -> 11 -> 6 -> 15 -> 2
- Candidate 4: 1 -> 3 -> 5 -> 7 -> 8 -> 9 -> 10 -> 12 -> 2
- Candidate 5: 1 -> 3 -> 5 -> 7 -> 8 -> 9 -> 11 -> 6 -> 15 -> 2
- Candidate 6: 1 -> 3 -> 5 -> 7 -> 13 -> 14 -> 2
- Candidate 7: 1 -> 3 -> 5 -> 7 -> 13 -> 16 -> 14 -> 2

Face boundaries: 1 -> 3 -> 5 -> 6 -> 15 -> 2 -> 4 -> 3; 2 -> 12 -> 10 -> 9 -> 8 -> 7 -> 13 -> 16 -> 14; 2 -> 15 -> 6 -> 11 -> 10 -> 12; 2 -> 14 -> 13 -> 7 -> 5 -> 3 -> 4; 5 -> 7 -> 8 -> 9 -> 11 -> 6; 9 -> 10 -> 11; 13 -> 14 -> 16. Additional parallel-edge lens faces: 0.

### invoiceTotal

Source: src/lib/validation.ts:94. [Graph](diagrams/cfg/invoiceTotal.svg).

- Candidate 1: 1 -> 3 -> 4 -> 5 -> 6 -> 2
- Candidate 2: 1 -> 3 -> 4 -> 5 -> 7 -> 2
- Candidate 3: 1 -> 3 -> 4 -> 6 -> 2

Face boundaries: 1 -> 3 -> 4 -> 6 -> 5 -> 4 -> 3; 2 -> 7 -> 5 -> 6; 2 -> 6 -> 4 -> 5 -> 7. Additional parallel-edge lens faces: 0.

### fileMime

Source: src/lib/validation.ts:125. [Graph](diagrams/cfg/fileMime.svg).

- Candidate 1: 1 -> 3 -> 4 -> 2
- Candidate 2: 1 -> 3 -> 5 -> 6 -> 2
- Candidate 3: 1 -> 3 -> 5 -> 7 -> 8 -> 9 -> 10 -> 2
- Candidate 4: 1 -> 3 -> 5 -> 7 -> 8 -> 9 -> 11 -> 2
- Candidate 5: 1 -> 3 -> 5 -> 7 -> 8 -> 11 -> 2
- Candidate 6: 1 -> 3 -> 5 -> 7 -> 11 -> 2

Face boundaries: 1 -> 3 -> 5 -> 6 -> 2 -> 4 -> 3; 2 -> 6 -> 5 -> 7 -> 11; 2 -> 10 -> 9 -> 8 -> 7 -> 5 -> 3 -> 4; 2 -> 11 -> 9 -> 10; 7 -> 8 -> 11; 8 -> 9 -> 11. Additional parallel-edge lens faces: 0.
