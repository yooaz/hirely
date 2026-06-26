/**
 * Hirely Storage — local CV library + optional Supabase cloud sync.
 */
(function (global) {
  const LIBRARY_KEY = 'hirely_cv_library_v1';
  const ACTIVE_ID_KEY = 'hirely_active_cv_id';
  const EXPORT_KEY = 'hirely_export_history_v1';
  const DRAFT_KEY = 'hirely_draft_v1';

  let getState = null;
  let applyState = null;
  let activeId = null;

  function uid(prefix = 'local') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function readLibrary() {
    try {
      const raw = localStorage.getItem(LIBRARY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function writeLibrary(list) {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(list));
  }

  function readExports() {
    try {
      const raw = localStorage.getItem(EXPORT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function writeExports(list) {
    localStorage.setItem(EXPORT_KEY, JSON.stringify(list.slice(0, 40)));
  }

  function captureSnapshot() {
    if (!getState) return null;
    const s = getState();
    return {
      cvText: s.cvText || '',
      job: s.job || '',
      jobText: s.jobText || '',
      industry: s.industry || 'Creative',
      currentTemplate: s.currentTemplate || 'ats',
      recommendedTemplate: s.recommendedTemplate || 'ats',
      cvDraft: s.cvDraft || null,
      premiumCV: s.lastData?.premiumCV || s.cvDraft || null,
      lastData: s.lastData || null,
      photoData: s.photoData || '',
      scoreSnapshot: s.scoreSnapshot ?? parseInt(document.querySelector('#scoreNum')?.textContent || '0', 10) || 0,
      savedAt: Date.now(),
    };
  }

  function defaultTitle(snapshot) {
    const name =
      snapshot?.premiumCV?.name ||
      snapshot?.cvDraft?.name ||
      snapshot?.lastData?.premiumCV?.name;
    if (name) return `${name} — CV`;
    const role = snapshot?.job?.trim();
    if (role) return role;
    return 'Untitled CV';
  }

  function init(options = {}) {
    getState = options.getState;
    applyState = options.applyState;
    activeId = localStorage.getItem(ACTIVE_ID_KEY);
    return { activeId };
  }

  function setActiveId(id) {
    activeId = id;
    if (id) localStorage.setItem(ACTIVE_ID_KEY, id);
    else localStorage.removeItem(ACTIVE_ID_KEY);
  }

  function getActiveId() {
    return activeId || localStorage.getItem(ACTIVE_ID_KEY);
  }

  function getDocument(id) {
    return readLibrary().find((d) => d.id === id) || null;
  }

  function listDocuments() {
    return readLibrary().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function upsertLocal(doc) {
    const list = readLibrary();
    const i = list.findIndex((d) => d.id === doc.id);
    if (i >= 0) list[i] = doc;
    else list.unshift(doc);
    writeLibrary(list);
    return doc;
  }

  function saveCurrent(title) {
    const snapshot = captureSnapshot();
    if (!snapshot?.cvText?.trim() && !snapshot?.premiumCV) {
      throw new Error('Add CV content before saving.');
    }
    const id = getActiveId() || uid();
    const existing = getDocument(id);
    const versions = existing?.versions || [];
    if (existing?.snapshot) {
      versions.unshift({
        versionNumber: (existing.versionCount || versions.length) + 1,
        label: `Version ${(existing.versionCount || versions.length) + 1}`,
        snapshot: existing.snapshot,
        createdAt: existing.updatedAt || Date.now(),
      });
    }
    const versionCount = (existing?.versionCount || 0) + (existing ? 1 : 0);
    const doc = {
      id,
      title: title || existing?.title || defaultTitle(snapshot),
      templateId: snapshot.currentTemplate,
      scoreSnapshot: snapshot.scoreSnapshot,
      updatedAt: Date.now(),
      createdAt: existing?.createdAt || Date.now(),
      snapshot,
      versions: versions.slice(0, 12),
      versionCount: Math.max(versionCount, versions.length + 1),
      cloudId: existing?.cloudId || null,
    };
    upsertLocal(doc);
    setActiveId(id);
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...snapshot, savedAt: Date.now() }));
    return doc;
  }

  async function syncToCloud(doc) {
    const client = global.HirelyAuth?.getClient?.();
    const user = global.HirelyAuth?.getUser?.();
    if (!client || !user) return doc;
    const row = {
      user_id: user.id,
      title: doc.title,
      template_id: doc.templateId,
      score_snapshot: doc.scoreSnapshot,
      cv_text: doc.snapshot.cvText,
      job: doc.snapshot.job,
      job_text: doc.snapshot.jobText,
      industry: doc.snapshot.industry,
      premium_cv: doc.snapshot.premiumCV,
      last_data: doc.snapshot.lastData,
      photo_data: doc.snapshot.photoData || null,
      version_count: doc.versionCount || 1,
      updated_at: new Date().toISOString(),
    };
    if (doc.cloudId) {
      const { data, error } = await client.from('cv_documents').update(row).eq('id', doc.cloudId).select().single();
      if (error) throw error;
      doc.cloudId = data.id;
    } else {
      const { data, error } = await client.from('cv_documents').insert(row).select().single();
      if (error) throw error;
      doc.cloudId = data.id;
      const snap = { snapshot: doc.snapshot, version_number: doc.versionCount || 1, label: 'Current' };
      await client.from('cv_versions').insert({
        document_id: data.id,
        user_id: user.id,
        version_number: doc.versionCount || 1,
        label: 'Current',
        snapshot: doc.snapshot,
      });
    }
    upsertLocal(doc);
    return doc;
  }

  async function saveCurrentWithCloud(title) {
    const doc = saveCurrent(title);
    if (global.HirelyAuth?.isSignedIn?.()) {
      try {
        await syncToCloud(doc);
      } catch (e) {
        console.warn('Cloud sync failed', e);
        doc.cloudPending = true;
        upsertLocal(doc);
      }
    }
    return doc;
  }

  function loadDocument(id) {
    const doc = getDocument(id);
    if (!doc?.snapshot || !applyState) return false;
    applyState(doc.snapshot);
    setActiveId(id);
    return true;
  }

  function duplicateDocument(id) {
    const src = getDocument(id);
    if (!src) throw new Error('CV not found');
    const copy = {
      ...src,
      id: uid(),
      title: `${src.title} (copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      cloudId: null,
      versions: [],
      versionCount: 1,
    };
    upsertLocal(copy);
    return copy;
  }

  function renameDocument(id, title) {
    const list = readLibrary();
    const doc = list.find((d) => d.id === id);
    if (!doc) throw new Error('CV not found');
    doc.title = title.trim() || doc.title;
    doc.updatedAt = Date.now();
    writeLibrary(list);
    return doc;
  }

  function deleteDocument(id) {
    const list = readLibrary().filter((d) => d.id !== id);
    writeLibrary(list);
    if (getActiveId() === id) setActiveId(null);
  }

  function restoreVersion(docId, versionIndex) {
    const doc = getDocument(docId);
    const ver = doc?.versions?.[versionIndex];
    if (!ver?.snapshot) throw new Error('Version not found');
    if (doc.snapshot) {
      doc.versions = doc.versions || [];
      doc.versions.unshift({
        versionNumber: doc.versionCount,
        label: `Backup before restore`,
        snapshot: doc.snapshot,
        createdAt: Date.now(),
      });
    }
    doc.snapshot = ver.snapshot;
    doc.updatedAt = Date.now();
    upsertLocal(doc);
    if (applyState) applyState(ver.snapshot);
    return doc;
  }

  function logExport(filename, type = 'pdf') {
    const entry = { filename, type, at: Date.now() };
    const list = [entry, ...readExports()];
    writeExports(list);
    return entry;
  }

  function listExports() {
    return readExports();
  }

  async function pullFromCloud() {
    const client = global.HirelyAuth?.getClient?.();
    const user = global.HirelyAuth?.getUser?.();
    if (!client || !user) return [];
    const { data, error } = await client
      .from('cv_documents')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    const local = readLibrary();
    (data || []).forEach((row) => {
      const snap = {
        cvText: row.cv_text || '',
        job: row.job || '',
        jobText: row.job_text || '',
        industry: row.industry || 'Creative',
        currentTemplate: row.template_id || 'ats',
        premiumCV: row.premium_cv,
        lastData: row.last_data,
        photoData: row.photo_data || '',
        scoreSnapshot: row.score_snapshot,
      };
      const existing = local.find((d) => d.cloudId === row.id);
      const doc = {
        id: existing?.id || uid('cloud'),
        cloudId: row.id,
        title: row.title,
        templateId: row.template_id,
        scoreSnapshot: row.score_snapshot,
        updatedAt: new Date(row.updated_at).getTime(),
        createdAt: new Date(row.created_at).getTime(),
        snapshot: snap,
        versions: existing?.versions || [],
        versionCount: row.version_count || 1,
      };
      upsertLocal(doc);
    });
    return listDocuments();
  }

  function autosaveTick() {
    const snapshot = captureSnapshot();
    if (!snapshot?.cvText?.trim() && !snapshot?.premiumCV) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...snapshot, savedAt: Date.now() }));
    const id = getActiveId();
    if (id) {
      const doc = getDocument(id);
      if (doc) {
        doc.snapshot = snapshot;
        doc.scoreSnapshot = snapshot.scoreSnapshot;
        doc.templateId = snapshot.currentTemplate;
        doc.updatedAt = Date.now();
        upsertLocal(doc);
      }
    }
  }

  global.HirelyStorage = {
    init,
    captureSnapshot,
    listDocuments,
    getDocument,
    getActiveId,
    setActiveId,
    saveCurrent,
    saveCurrentWithCloud,
    loadDocument,
    duplicateDocument,
    renameDocument,
    deleteDocument,
    restoreVersion,
    logExport,
    listExports,
    pullFromCloud,
    autosaveTick,
    defaultTitle,
  };
})(typeof window !== 'undefined' ? window : globalThis);
