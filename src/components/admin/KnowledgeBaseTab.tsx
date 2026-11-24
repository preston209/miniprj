import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileUp, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../../lib/api.ts';
import { formatShortDate } from '../../lib/utils.ts';
import type { KnowledgeDocSummary, PropertyData } from '../../types/pg.ts';
import { Button, Card, Input, Select, Textarea } from '../ui/primitives.tsx';

type CategoryFilter =
  | 'all'
  | 'policy'
  | 'house_rules'
  | 'weekly_menu'
  | 'room_inventory'
  | 'neighborhood_guide'
  | 'faq'
  | 'uploaded_doc';

const SOURCE_TYPE_LABELS: Record<CategoryFilter, string> = {
  all: 'All Sources',
  policy: 'Policy',
  house_rules: 'House Rules',
  weekly_menu: 'Menu',
  room_inventory: 'Inventory',
  neighborhood_guide: 'Neighborhood',
  faq: 'FAQs',
  uploaded_doc: 'Uploads',
};

interface KnowledgeBaseTabProps {
  property: PropertyData | null;
  documents: KnowledgeDocSummary[];
  totalChunks: number;
}

export function KnowledgeBaseTab({
  property,
  documents,
  totalChunks,
}: KnowledgeBaseTabProps) {
  const queryClient = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [kbTitle, setKbTitle] = useState('');
  const [kbSection, setKbSection] = useState('');
  const [kbSourceType, setKbSourceType] =
    useState<KnowledgeDocSummary['sourceType']>('policy');
  const [kbContent, setKbContent] = useState('');
  const [editingMode, setEditingMode] = useState(false);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadSourceType, setUploadSourceType] =
    useState<KnowledgeDocSummary['sourceType']>('uploaded_doc');
  const [kbNotice, setKbNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const ingestTextMutation = useMutation({
    mutationFn: api.ingestTextKnowledge,
    onSuccess: (res) => {
      setKbTitle('');
      setKbSection('');
      setKbContent('');
      setEditingMode(false);
      setKbNotice({ type: 'ok', text: res.message });
      queryClient.invalidateQueries({ queryKey: ['admin', 'knowledge'] });
    },
    onError: (err) => {
      setKbNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to embed knowledge document.',
      });
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: api.uploadKnowledgeFile,
    onSuccess: (res) => {
      setUploadFile(null);
      setUploadTitle('');
      setKbNotice({ type: 'ok', text: res.message });
      queryClient.invalidateQueries({ queryKey: ['admin', 'knowledge'] });
    },
    onError: (err) => {
      setKbNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to upload & embed file.',
      });
    },
  });

  const reindexMutation = useMutation({
    mutationFn: api.reindexKnowledge,
    onSuccess: (res) => {
      setKbNotice({
        type: 'ok',
        text: `Synced ${res.summary.roomsSynced} room(s) & rebuilt ${res.summary.chunksReembedded} vector chunks.`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'knowledge'] });
    },
    onError: (err) => {
      setKbNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Re-sync failed.',
      });
    },
  });

  const deleteKbMutation = useMutation({
    mutationFn: api.deleteKnowledgeDoc,
    onSuccess: (res) => {
      setKbNotice({ type: 'ok', text: res.message });
      queryClient.invalidateQueries({ queryKey: ['admin', 'knowledge'] });
    },
  });

  const loadForEditMutation = useMutation({
    mutationFn: api.getKnowledgeContent,
    onSuccess: ({ document }) => {
      setKbTitle(document.title);
      setKbSection(document.sourceSection);
      setKbSourceType(document.sourceType);
      setKbContent(document.content);
      setEditingMode(true);
      setKbNotice({
        type: 'ok',
        text: `Loaded "${document.title}" (${document.chunkCount} chunks) into editor. Saving replaces stale chunks.`,
      });
    },
    onError: (err) => {
      setKbNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to load document content.',
      });
    },
  });

  const countsByType = useMemo(() => {
    const map: Record<string, number> = { all: documents.length };
    for (const d of documents) {
      map[d.sourceType] = (map[d.sourceType] ?? 0) + 1;
    }
    return map;
  }, [documents]);

  const filteredDocs = useMemo(
    () =>
      categoryFilter === 'all'
        ? documents
        : documents.filter((d) => d.sourceType === categoryFilter),
    [documents, categoryFilter]
  );

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setKbNotice(null);
    const formData = new FormData();
    formData.append('file', uploadFile);
    if (property?._id) formData.append('propertyId', property._id);
    if (uploadTitle.trim()) formData.append('title', uploadTitle.trim());
    formData.append('sourceType', uploadSourceType);
    uploadFileMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            RAG Knowledge Base Manager
          </h2>
          <p className="text-xs text-slate-500">
            Total indexed vector chunks:{' '}
            <span className="font-mono-tabular font-semibold text-slate-900">{totalChunks}</span>{' '}
            (500-char chunks, 50 overlap, 768-dim Gemini embeddings)
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={reindexMutation.isPending || !property}
          onClick={() => reindexMutation.mutate()}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${reindexMutation.isPending ? 'animate-spin' : ''}`}
          />
          Re-sync Live DB to RAG
        </Button>
      </div>

      {kbNotice && (
        <div
          className={`rounded-lg border px-4 py-2.5 text-xs font-medium ${
            kbNotice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {kbNotice.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Upload Rulebook */}
        <Card className="space-y-4 p-6 lg:col-span-5">
          <div className="flex items-center gap-2">
            <FileUp className="h-4 w-4 text-[#0f766e]" />
            <h3 className="font-display text-base font-bold text-slate-900">
              Upload Rulebook (PDF / MD / TXT)
            </h3>
          </div>
          <form onSubmit={handleUploadSubmit} className="space-y-3">
            <Input
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="Document Title (e.g., 2026 Resident Handbook)"
            />
            <Select
              value={uploadSourceType}
              onChange={(e) =>
                setUploadSourceType(e.target.value as KnowledgeDocSummary['sourceType'])
              }
            >
              <option value="uploaded_doc">Uploaded Document</option>
              <option value="policy">Policy</option>
              <option value="house_rules">House Rules</option>
              <option value="neighborhood_guide">Neighborhood / Commute Guide</option>
            </Select>
            <input
              type="file"
              accept=".pdf,.md,.txt"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-slate-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-100"
              required
            />
            <Button
              type="submit"
              className="w-full"
              disabled={!uploadFile || uploadFileMutation.isPending || !property}
            >
              {uploadFileMutation.isPending ? 'Chunking & Embedding...' : 'Upload & Embed'}
            </Button>
          </form>
        </Card>

        {/* Add / Edit Rulebook, Policy, FAQ or Commute Guide */}
        <Card className="space-y-4 p-6 lg:col-span-7">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-slate-900">
              {editingMode
                ? 'Edit Indexed Knowledge Document'
                : 'Add or Update Rulebook / Policy / Commute Guide'}
            </h3>
            {editingMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingMode(false);
                  setKbTitle('');
                  setKbSection('');
                  setKbContent('');
                }}
              >
                Clear Editor
              </Button>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setKbNotice(null);
              ingestTextMutation.mutate({
                propertyId: property?._id,
                title: kbTitle,
                sourceSection: kbSection,
                sourceType: kbSourceType,
                content: kbContent,
              });
            }}
            className="space-y-3"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                value={kbTitle}
                onChange={(e) => setKbTitle(e.target.value)}
                placeholder="Title (e.g., Parking Policy)"
                required
              />
              <Input
                value={kbSection}
                onChange={(e) => setKbSection(e.target.value)}
                placeholder="Section Citation"
                required
              />
              <Select
                value={kbSourceType}
                onChange={(e) =>
                  setKbSourceType(e.target.value as KnowledgeDocSummary['sourceType'])
                }
              >
                <option value="policy">Policy</option>
                <option value="house_rules">House Rules</option>
                <option value="neighborhood_guide">Neighborhood / Commute</option>
                <option value="faq">FAQ</option>
                <option value="uploaded_doc">Custom Markdown Doc</option>
              </Select>
            </div>
            <Textarea
              rows={4}
              value={kbContent}
              onChange={(e) => setKbContent(e.target.value)}
              placeholder="Enter Markdown or plain text rules, timings, fees, or local transit guide..."
              required
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={ingestTextMutation.isPending || !property}>
                {ingestTextMutation.isPending
                  ? 'Embedding...'
                  : editingMode
                  ? 'Replace Chunks & Re-Embed'
                  : 'Save & Index Document'}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {/* Category Group Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
        {(Object.keys(SOURCE_TYPE_LABELS) as CategoryFilter[]).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              categoryFilter === cat
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {SOURCE_TYPE_LABELS[cat]}{' '}
            <span className="font-mono-tabular text-slate-400">({countsByType[cat] ?? 0})</span>
          </button>
        ))}
      </div>

      {/* Indexed Documents Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Document & Section</th>
                <th className="px-4 py-3">Source Type</th>
                <th className="px-4 py-3 text-right">Chunks</th>
                <th className="px-4 py-3">Vector Status</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.map((doc) => (
                <tr
                  key={`${doc.sourceType}:${doc.sourceSection}`}
                  className="hover:bg-slate-50/70"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{doc.title}</p>
                    <p className="text-xs text-slate-500">{doc.sourceSection}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{doc.sourceType}</td>
                  <td className="px-4 py-3 text-right font-mono-tabular text-xs text-slate-900">
                    {doc.chunkCount}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {doc.hasEmbeddings ? (
                      <span className="font-medium text-emerald-700">Embedded (768d)</span>
                    ) : (
                      <span className="font-medium text-amber-700">Placeholder</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono-tabular text-xs text-slate-500">
                    {formatShortDate(doc.updatedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          loadForEditMutation.mutate({
                            propertyId: doc.propertyId,
                            sourceType: doc.sourceType,
                            sourceSection: doc.sourceSection,
                          })
                        }
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                        aria-label={`Edit ${doc.title}`}
                        title="Load into editor"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          deleteKbMutation.mutate({
                            propertyId: doc.propertyId,
                            sourceType: doc.sourceType,
                            sourceSection: doc.sourceSection,
                          })
                        }
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                        aria-label="Delete indexed document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    No indexed knowledge documents in this category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
