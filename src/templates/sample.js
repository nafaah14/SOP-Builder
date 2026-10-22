import { newSop, newBlock } from '../model/defaults';

/** A believable SOP to preview a template against. */
export function sampleDoc(template) {
  const doc = newSop('Sample procedure title', template);
  return {
    ...doc,
    docNo: 'SOP-OPS-001',
    department: 'Operations',
    control: {
      prepared: { name: 'A. Writer', position: 'Engineer', date: doc.effectiveDate },
      reviewed: { name: 'B. Reviewer', position: 'Supervisor', date: doc.effectiveDate },
      approved: { name: 'C. Approver', position: 'Manager', date: doc.effectiveDate },
    },
    blocks: [
      { ...newBlock('section'), title: 'Purpose' },
      { ...newBlock('text'), body: 'This procedure describes how the task is carried out safely and consistently.' },
      { ...newBlock('section'), title: 'Procedure' },
      { ...newBlock('step'), title: 'Prepare the work area', body: 'Confirm the area is clear and **isolate** the equipment.\n- Lock and tag the isolator\n- Verify zero energy' },
      { ...newBlock('step'), title: 'Carry out the task', body: 'Follow the manufacturer instructions.' },
    ],
  };
}
