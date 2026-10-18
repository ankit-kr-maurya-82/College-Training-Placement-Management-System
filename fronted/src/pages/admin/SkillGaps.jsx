import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { Busy, Notice } from '../../components/Feedback.jsx';
import DataTable from '../../components/DataTable.jsx';

export default function SkillGaps() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let live = true;
    setBusy(true);
    api
      .get('/admin/analytics/skill-gaps')
      .then((res) => {
        if (live) setData(res);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, []);

  if (busy && !data) return <Busy label="Loading skill gaps…" />;
  if (error && !data) return <Notice error={error} />;

  const rows = (data?.skillGaps || []).map((row) => ({
    skill: row.skill,
    driveCount: row.driveCount,
    studentsWithSkill: row.studentsWithSkill,
    activeStudentsMissingSkill: row.activeStudentsMissingSkill,
  }));

  const columns = [
    { key: 'skill', label: 'Skill' },
    { key: 'driveCount', label: 'Open Drives' },
    { key: 'studentsWithSkill', label: 'Students with Skill' },
    { key: 'activeStudentsMissingSkill', label: 'Active Students Missing Skill' },
  ];

  return (
    <>
      <h2>Institution‑wide Skill Gaps</h2>
      <p className="muted">
        Aggregated counts of open drives requiring each skill and how many active student profiles list or lack the skill.
      </p>
      <DataTable rows={rows} columns={columns} emptyMessage="No skill gap data available." />
    </>
  );
}

