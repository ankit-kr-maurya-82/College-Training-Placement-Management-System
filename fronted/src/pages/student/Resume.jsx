import React, { useEffect, useState } from "react";
import { api } from "../../services/api";
import "../../styles/resumeTemplates.css";

function emptyResume() {
    return {
        personal: { name: "", email: "", phone: "", location: "", linkedin: "", github: "", portfolio: "" },
        summary: "",
        education: [{ institution: "", degree: "", department: "", graduationYear: "", cgpa: "" }],
        technicalSkills: "",
        softSkills: "",
        projects: [],
        experience: [],
        certifications: [],
        achievements: [],
    };
}

export default function Resume() {
    const [resume, setResume] = useState(null);
    const [status, setStatus] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [template, setTemplate] = useState("modern");
    const [builder, setBuilder] = useState(emptyResume());
    useEffect(() => {
        api.get("/students/me/profile").then((data) => {
            const s = data.student || {};
            setBuilder((prev) => ({
                ...prev,
                personal: { ...prev.personal, name: s.name || "", email: s.email || "", phone: s.phone || "" },
                education: prev.education.map((e, i) => i === 0 ? { ...e, department: s.department || e.department, graduationYear: s.graduationYear || e.graduationYear, cgpa: s.cgpa || e.cgpa } : e),
                technicalSkills: (s.skills || []).join(", "),
            }));
        }).catch(() => {});
        api.get("/students/me/resume").then((data) => setResume(data.resume)).catch(() => setResume(null));
        api.get("/students/me/resume/analysis-status").then((data) => setStatus(data)).catch(() => setStatus(null));
        api.get("/students/me/resume/analysis").then((data) => setAnalysis(data)).catch(() => setAnalysis(null));
    }, []);

    function setField(path, value) {
        setBuilder((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            const keys = path.split(".");
            let cur = next;
            for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
            cur[keys[keys.length - 1]] = value;
            return next;
        });
    }

    function updateArray(section, i, field, value) {
        setBuilder((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            next[section][i][field] = value;
            return next;
        });
    }

    function addArrayItem(section, item) {
        setBuilder((prev) => ({ ...prev, [section]: [...prev[section], item] }));
    }

    function removeArrayItem(section, i) {
        setBuilder((prev) => ({ ...prev, [section]: prev[section].filter((_, idx) => idx !== i) }));
    }

    async function upload(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert("Resume exceeds 5 MB"); return; }
        setLoading(true);
        const form = new FormData();
        form.append("resume", file);
        try {
            const data = await api.post("/students/me/resume", form);
            setResume(data.resume);
        } catch (e) { alert(e.message); }
        finally { setLoading(false); }
    }

    async function analyze() {
        setLoading(true);
        try {
            await api.post("/students/me/resume/analyze");
            const data = await api.get("/students/me/resume/analysis");
            setAnalysis(data);
        } catch (e) { alert(e.message); }
        finally { setLoading(false); }
    }

    function downloadPdf() {
        const w = window.open("", "_blank");
        if (!w) return;
        w.document.write(`<html><head><title>${builder.personal.name || "Resume"}</title><style>body{font-family:sans-serif;margin:20px}h1{font-size:20px}h2{font-size:16px;margin-top:12px}p{margin:4px 0}</style></head><body>${document.getElementById("resume-preview")?.innerHTML || ""}</body></html>`);
        w.document.close();
        w.print();
    }

    return (
        <div className="p-6 max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <h1 className="text-2xl font-bold">Resume Builder</h1>
                <input className="w-full border p-2 rounded" placeholder="Full name" value={builder.personal.name} onChange={(e) => setField("personal.name", e.target.value)} />
                <input className="w-full border p-2 rounded" placeholder="Email" value={builder.personal.email} onChange={(e) => setField("personal.email", e.target.value)} />
                <input className="w-full border p-2 rounded" placeholder="Phone" value={builder.personal.phone} onChange={(e) => setField("personal.phone", e.target.value)} />
                <input className="w-full border p-2 rounded" placeholder="Location" value={builder.personal.location} onChange={(e) => setField("personal.location", e.target.value)} />
                <input className="w-full border p-2 rounded" placeholder="LinkedIn URL" value={builder.personal.linkedin} onChange={(e) => setField("personal.linkedin", e.target.value)} />
                <input className="w-full border p-2 rounded" placeholder="GitHub URL" value={builder.personal.github} onChange={(e) => setField("personal.github", e.target.value)} />
                <input className="w-full border p-2 rounded" placeholder="Portfolio URL" value={builder.personal.portfolio} onChange={(e) => setField("personal.portfolio", e.target.value)} />
                <textarea className="w-full border p-2 rounded" placeholder="Professional summary" value={builder.summary} onChange={(e) => setField("summary", e.target.value)} />
                <input className="w-full border p-2 rounded" placeholder="Technical skills (comma separated)" value={builder.technicalSkills} onChange={(e) => setField("technicalSkills", e.target.value)} />
                <input className="w-full border p-2 rounded" placeholder="Soft skills (comma separated)" value={builder.softSkills} onChange={(e) => setField("softSkills", e.target.value)} />

                <h2 className="text-lg font-bold mt-4">Education</h2>
                {builder.education.map((ed, i) => (
                    <div key={i} className="border p-2 rounded space-y-2">
                        <input className="w-full border p-2 rounded" placeholder="Institution" value={ed.institution} onChange={(e) => updateArray("education", i, "institution", e.target.value)} />
                        <input className="w-full border p-2 rounded" placeholder="Degree/Course" value={ed.degree} onChange={(e) => updateArray("education", i, "degree", e.target.value)} />
                        <input className="w-full border p-2 rounded" placeholder="Department" value={ed.department} onChange={(e) => updateArray("education", i, "department", e.target.value)} />
                        <input className="w-full border p-2 rounded" placeholder="Graduation Year" value={ed.graduationYear} onChange={(e) => updateArray("education", i, "graduationYear", e.target.value)} />
                        <input className="w-full border p-2 rounded" placeholder="CGPA" value={ed.cgpa} onChange={(e) => updateArray("education", i, "cgpa", e.target.value)} />
                        <button className="text-red-600 text-sm" onClick={() => removeArrayItem("education", i)}>Remove</button>
                    </div>
                ))}
                <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => addArrayItem("education", { institution: "", degree: "", department: "", graduationYear: "", cgpa: "" })}>Add Education</button>

                <h2 className="text-lg font-bold mt-4">Projects</h2>
                <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => addArrayItem("projects", { title: "", description: "", technologies: "", url: "" })}>Add Project</button>
                {builder.projects.map((p, i) => (
                    <div key={i} className="border p-2 rounded space-y-2 mt-2">
                        <input className="w-full border p-2 rounded" placeholder="Title" value={p.title} onChange={(e) => updateArray("projects", i, "title", e.target.value)} />
                        <textarea className="w-full border p-2 rounded" placeholder="Description" value={p.description} onChange={(e) => updateArray("projects", i, "description", e.target.value)} />
                        <input className="w-full border p-2 rounded" placeholder="Technologies" value={p.technologies} onChange={(e) => updateArray("projects", i, "technologies", e.target.value)} />
                        <input className="w-full border p-2 rounded" placeholder="URL" value={p.url} onChange={(e) => updateArray("projects", i, "url", e.target.value)} />
                        <button className="text-red-600 text-sm" onClick={() => removeArrayItem("projects", i)}>Remove</button>
                    </div>
                ))}

                <h2 className="text-lg font-bold mt-4">Experience</h2>
                <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => addArrayItem("experience", { organization: "", role: "", duration: "", description: "" })}>Add Experience</button>
                {builder.experience.map((x, i) => (
                    <div key={i} className="border p-2 rounded space-y-2 mt-2">
                        <input className="w-full border p-2 rounded" placeholder="Organization" value={x.organization} onChange={(e) => updateArray("experience", i, "organization", e.target.value)} />
                        <input className="w-full border p-2 rounded" placeholder="Role" value={x.role} onChange={(e) => updateArray("experience", i, "role", e.target.value)} />
                        <input className="w-full border p-2 rounded" placeholder="Duration" value={x.duration} onChange={(e) => updateArray("experience", i, "duration", e.target.value)} />
                        <textarea className="w-full border p-2 rounded" placeholder="Description" value={x.description} onChange={(e) => updateArray("experience", i, "description", e.target.value)} />
                        <button className="text-red-600 text-sm" onClick={() => removeArrayItem("experience", i)}>Remove</button>
                    </div>
                ))}

                <h2 className="text-lg font-bold mt-4">Certifications</h2>
                <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => addArrayItem("certifications", { name: "", issuer: "", date: "", url: "" })}>Add Certification</button>
                {builder.certifications.map((c, i) => (
                    <div key={i} className="border p-2 rounded space-y-2 mt-2">
                        <input className="w-full border p-2 rounded" placeholder="Certification name" value={c.name} onChange={(e) => updateArray("certifications", i, "name", e.target.value)} />
                        <input className="w-full border p-2 rounded" placeholder="Issuer" value={c.issuer} onChange={(e) => updateArray("certifications", i, "issuer", e.target.value)} />
                        <input className="w-full border p-2 rounded" placeholder="Date/Year" value={c.date} onChange={(e) => updateArray("certifications", i, "date", e.target.value)} />
                        <input className="w-full border p-2 rounded" placeholder="Credential URL" value={c.url} onChange={(e) => updateArray("certifications", i, "url", e.target.value)} />
                        <button className="text-red-600 text-sm" onClick={() => removeArrayItem("certifications", i)}>Remove</button>
                    </div>
                ))}

                <h2 className="text-lg font-bold mt-4">Achievements</h2>
                <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => addArrayItem("achievements", { title: "", description: "", date: "" })}>Add Achievement</button>
                {builder.achievements.map((a, i) => (
                    <div key={i} className="border p-2 rounded space-y-2 mt-2">
                        <input className="w-full border p-2 rounded" placeholder="Title" value={a.title} onChange={(e) => updateArray("achievements", i, "title", e.target.value)} />
                        <textarea className="w-full border p-2 rounded" placeholder="Description" value={a.description} onChange={(e) => updateArray("achievements", i, "description", e.target.value)} />
                        <input className="w-full border p-2 rounded" placeholder="Date/Year" value={a.date} onChange={(e) => updateArray("achievements", i, "date", e.target.value)} />
                        <button className="text-red-600 text-sm" onClick={() => removeArrayItem("achievements", i)}>Remove</button>
                    </div>
                ))}

                <h2 className="text-lg font-bold mt-4">Resume Analyzer</h2>
                <input type="file" accept=".pdf,.docx" onChange={upload} disabled={loading} />
                {resume && <p className="mt-2 text-sm">{resume.originalFileName} ({resume.fileSize} bytes) - {resume.extractionStatus}</p>}
                <button className="mt-2 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50" onClick={analyze} disabled={loading}>Analyze</button>
                {analysis && <p className="mt-2 text-sm">Score: {analysis.analysis?.overallScore ?? "N/A"}</p>}
            </div>

            <div>
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-xl font-bold">Preview</h2>
                    <select value={template} onChange={(e) => setTemplate(e.target.value)} className="border p-1 rounded">
                        <option value="modern">Modern Professional</option>
                        <option value="minimal">Minimal ATS</option>
                        <option value="executive">Executive</option>
                    </select>
                    <select value={template} onChange={(e) => setTemplate(e.target.value)} className="border p-1 rounded">
                        <option value="modern">Modern Professional</option>
                        <option value="minimal">Minimal ATS</option>
                        <option value="executive">Executive</option>
                    </select>
                    <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={downloadPdf}>Download PDF</button>
                </div>
                <div id="resume-preview" className={`border p-6 bg-white shadow text-sm space-y-3 template-${template}`}>
                    <h1 className="text-xl font-bold">{builder.personal.name || "Your Name"}</h1>
                    <p>{builder.personal.email} {builder.personal.phone} {builder.personal.location}</p>
                    {builder.personal.linkedin && <p>{builder.personal.linkedin}</p>}
                    {builder.personal.github && <p>{builder.personal.github}</p>}
                    {builder.personal.portfolio && <p>{builder.personal.portfolio}</p>}
                    {builder.summary && <p>{builder.summary}</p>}
                    {builder.technicalSkills && <p><strong>Technical Skills:</strong> {builder.technicalSkills}</p>}
                    {builder.softSkills && <p><strong>Soft Skills:</strong> {builder.softSkills}</p>}
                    {builder.education.some((e) => e.institution || e.degree) && (
                        <div>
                            <h3 className="font-semibold">Education</h3>
                            {builder.education.map((e, i) => (e.institution || e.degree) && <p key={i}>{e.degree} - {e.institution} {e.graduationYear} {e.cgpa && `CGPA: ${e.cgpa}`}</p>)}
                        </div>
                    )}
                    {builder.projects.length > 0 && (
                        <div>
                            <h3 className="font-semibold">Projects</h3>
                            {builder.projects.map((p, i) => (
                                <div key={i} className="mb-2">
                                    <p className="font-medium">{p.title}</p>
                                    <p>{p.description}</p>
                                    {p.technologies && <p className="text-xs">Tech: {p.technologies}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                    {builder.experience.length > 0 && (
                        <div>
                            <h3 className="font-semibold">Experience</h3>
                            {builder.experience.map((x, i) => (
                                <div key={i} className="mb-2">
                                    <p className="font-medium">{x.role} - {x.organization}</p>
                                    <p className="text-xs">{x.duration}</p>
                                    <p>{x.description}</p>
                                </div>
                            ))}
                        </div>
                    )}
                    {builder.certifications.length > 0 && (
                        <div>
                            <h3 className="font-semibold">Certifications</h3>
                            {builder.certifications.map((c, i) => (
                                <div key={i} className="mb-2">
                                    <p className="font-medium">{c.name} {c.date && `(${c.date})`}</p>
                                    <p className="text-xs">{c.issuer} {c.url}</p>
                                </div>
                            ))}
                        </div>
                    )}
                    {builder.achievements.length > 0 && (
                        <div>
                            <h3 className="font-semibold">Achievements</h3>
                            {builder.achievements.map((a, i) => (
                                <div key={i} className="mb-2">
                                    <p className="font-medium">{a.title} {a.date && `(${a.date})`}</p>
                                    <p>{a.description}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
