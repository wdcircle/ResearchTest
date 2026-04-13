// main.ts
import { App, ItemView, MarkdownView, Menu, Modal, Notice, Plugin, WorkspaceLeaf, requestUrl } from 'obsidian';
import { DEFAULT_SETTINGS, MyPluginSettings, SampleSettingTab } from "./settings";

export const CODE_VIEWER_VIEW_TYPE = 'pharos-code-viewer';

// ============================
// 코드 뷰어 패널 (ItemView)
// ============================
export class CodeViewerView extends ItemView {
	plugin: MyPlugin;
	private recentPaths: Set<string> = new Set();

	constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() { return CODE_VIEWER_VIEW_TYPE; }
	getDisplayText() { return 'Pharos 코드 뷰어'; }
	getIcon() { return 'code'; }

	async onOpen() { await this.render(); }

	async render() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('pharos-viewer-root');

		const style = container.createEl('style');
		style.textContent = `
			.pharos-viewer-root { display:flex; flex-direction:column; height:100%; font-family:var(--font-interface); overflow:hidden; }
			.pharos-tabs { display:flex; gap:2px; padding:6px 8px 0; background:var(--background-secondary); border-bottom:1px solid var(--background-modifier-border); flex-shrink:0; }
			.pharos-tab { padding:5px 14px; cursor:pointer; font-size:12px; border-bottom:2px solid transparent; color:var(--text-muted); border-radius:4px 4px 0 0; }
			.pharos-tab.active { border-bottom-color:var(--interactive-accent); color:var(--text-normal); font-weight:600; background:var(--background-primary); }
			.pharos-toolbar { display:flex; align-items:center; gap:6px; padding:8px 10px; border-bottom:1px solid var(--background-modifier-border); background:var(--background-secondary); flex-shrink:0; }
			.pharos-toolbar select { flex:1; font-size:12px; background:var(--background-primary); color:var(--text-normal); border:1px solid var(--background-modifier-border); border-radius:4px; padding:3px 6px; }
			.pharos-toolbar button { font-size:12px; padding:3px 8px; border-radius:4px; cursor:pointer; background:var(--interactive-accent); color:var(--text-on-accent); border:none; }
			.pharos-body { display:flex; flex:1; overflow:hidden; }
			.pharos-tab-content { display:flex; flex:1; overflow:hidden; flex-direction:column; }

			/* 파일 트리 탭 */
			.pharos-file-tree { width:200px; min-width:140px; border-right:1px solid var(--background-modifier-border); overflow-y:auto; background:var(--background-secondary); flex-shrink:0; }
			.pharos-file-tree-header { font-size:11px; font-weight:600; color:var(--text-muted); padding:8px 10px 4px; text-transform:uppercase; }
			.pharos-file-item { display:flex; align-items:center; gap:5px; padding:4px 10px; font-size:12px; cursor:pointer; border-left:2px solid transparent; }
			.pharos-file-item.active { background:var(--background-modifier-active-hover); border-left-color:var(--interactive-accent); color:var(--interactive-accent); font-weight:600; }
			.pharos-file-item.recent { border-left-color:#f59e0b; }
			.pharos-recent-badge { font-size:9px; background:#f59e0b; color:white; padding:1px 4px; border-radius:3px; margin-left:4px; }
			.pharos-private-badge { font-size:9px; background:#6366f1; color:white; padding:1px 5px; border-radius:3px; margin-left:6px; }

			/* 코드 패널 */
			.pharos-code-panel { flex:1; display:flex; flex-direction:column; overflow:hidden; }
			.pharos-code-header { display:flex; align-items:center; justify-content:space-between; padding:6px 12px; background:var(--background-secondary); border-bottom:1px solid var(--background-modifier-border); font-size:12px; flex-shrink:0; }
			.pharos-code-scroll { flex:1; overflow:auto; background:var(--background-primary); }
			.pharos-code-scroll pre { margin:0; padding:16px; font-size:12px; line-height:1.6; font-family:var(--font-monospace); white-space:pre; }
			.pharos-copy-btn { font-size:11px; padding:2px 8px; border-radius:3px; cursor:pointer; background:var(--background-modifier-border); color:var(--text-normal); border:none; }

			/* 팀원 탭 */
			.pharos-member-list { width:200px; min-width:160px; border-right:1px solid var(--background-modifier-border); overflow-y:auto; background:var(--background-secondary); flex-shrink:0; }
			.pharos-member-item { display:flex; align-items:center; gap:8px; padding:8px 10px; cursor:pointer; border-left:3px solid transparent; font-size:13px; }
			.pharos-member-item:hover { background:var(--background-modifier-hover); }
			.pharos-member-item.active { border-left-color:var(--interactive-accent); background:var(--background-modifier-active-hover); font-weight:600; }
			.pharos-member-avatar { width:26px; height:26px; border-radius:50%; flex-shrink:0; }
			.pharos-member-info { flex:1; min-width:0; }
			.pharos-member-name { font-size:12px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
			.pharos-member-commits { font-size:10px; color:var(--text-muted); }

			.pharos-commit-panel { flex:1; display:flex; flex-direction:column; overflow:hidden; }
			.pharos-commit-list { width:260px; min-width:200px; border-right:1px solid var(--background-modifier-border); overflow-y:auto; flex-shrink:0; }
			.pharos-commit-item { padding:8px 12px; cursor:pointer; border-bottom:1px solid var(--background-modifier-border); border-left:3px solid transparent; }
			.pharos-commit-item:hover { background:var(--background-modifier-hover); }
			.pharos-commit-item.active { border-left-color:var(--interactive-accent); background:var(--background-modifier-active-hover); }
			.pharos-commit-msg { font-size:12px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
			.pharos-commit-date { font-size:10px; color:var(--text-muted); margin-top:2px; }
			.pharos-commit-sha { font-size:10px; color:var(--text-muted); font-family:var(--font-monospace); }

			.pharos-file-change-list { width:200px; min-width:160px; border-right:1px solid var(--background-modifier-border); overflow-y:auto; background:var(--background-secondary); flex-shrink:0; }
			.pharos-file-change-item { padding:6px 10px; cursor:pointer; border-left:3px solid transparent; font-size:11px; }
			.pharos-file-change-item:hover { background:var(--background-modifier-hover); }
			.pharos-file-change-item.active { border-left-color:var(--interactive-accent); background:var(--background-modifier-active-hover); }
			.pharos-file-change-name { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
			.pharos-file-change-stat { font-size:10px; color:var(--text-muted); }
			.pharos-stat-add { color:#22c55e; }
			.pharos-stat-del { color:#ef4444; }

			.pharos-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--text-muted); gap:8px; }
			.pharos-placeholder .ph-icon { font-size:28px; }
			.pharos-placeholder .ph-text { font-size:12px; }
			.pharos-loading { padding:16px; text-align:center; color:var(--text-muted); font-size:12px; }
			.pharos-section-header { font-size:11px; font-weight:600; color:var(--text-muted); padding:8px 10px 4px; text-transform:uppercase; border-bottom:1px solid var(--background-modifier-border); }
		`;

		const tabBar = container.createDiv({ cls: 'pharos-tabs' });
		const tabContent = container.createDiv({ cls: 'pharos-tab-content' });

		const tabs = [
			{ id: 'files', label: '📁 파일 탐색' },
			{ id: 'members', label: '👥 팀원별 커밋' },
		];

		let activeTabId = 'files';

		const switchTab = (tabId: string) => {
			activeTabId = tabId;
			tabBar.querySelectorAll('.pharos-tab').forEach(t => t.removeClass('active'));
			tabBar.querySelector(`[data-tab="${tabId}"]`)?.addClass('active');
			tabContent.empty();
			if (tabId === 'files') this.renderFilesTab(tabContent);
			else this.renderMembersTab(tabContent);
		};

		tabs.forEach(tab => {
			const el = tabBar.createDiv({ cls: 'pharos-tab', text: tab.label });
			el.setAttribute('data-tab', tab.id);
			el.addEventListener('click', () => switchTab(tab.id));
		});

		switchTab('files');
	}

	async renderFilesTab(container: HTMLElement) {
		const toolbar = container.createDiv({ cls: 'pharos-toolbar' });
		const branchSelect = toolbar.createEl('select');
		const refreshBtn = toolbar.createEl('button', { text: '🔄' });

		const body = container.createDiv({ cls: 'pharos-body' });
		const fileTree = body.createDiv({ cls: 'pharos-file-tree' });
		const codePanel = body.createDiv({ cls: 'pharos-code-panel' });

		codePanel.createDiv({ cls: 'pharos-placeholder' }).innerHTML = '<div class="ph-icon">📂</div><div class="ph-text">파일을 선택하세요</div>';

		const loadTree = async () => {
			fileTree.empty();
			fileTree.createDiv({ cls: 'pharos-loading', text: '불러오는 중...' });
			const branch = branchSelect.value;
			try {
				this.recentPaths = await this.plugin.fetchRecentlyChangedFiles(branch);
				const tree = await this.plugin.fetchFileTree(branch);
				this.renderFileTree(fileTree, tree, codePanel, branchSelect);
			} catch (e) {
				fileTree.empty();
				fileTree.createDiv({ cls: 'pharos-loading', text: '❌ 로드 실패. 토큰/레포 확인' });
			}
		};

		refreshBtn.addEventListener('click', loadTree);
		branchSelect.addEventListener('change', loadTree);

		try {
			const branches = await this.plugin.fetchBranches();
			branches.forEach((b: { name: string }) => {
				const opt = branchSelect.createEl('option', { text: b.name });
				opt.value = b.name;
				if (b.name === 'main' || b.name === 'master') opt.selected = true;
			});
			const isPrivate = await this.plugin.isRepoPrivate();
			if (isPrivate) toolbar.createSpan({ cls: 'pharos-private-badge', text: '🔒 private' });
			await loadTree();
		} catch {
			branchSelect.createEl('option', { text: '로드 실패' });
		}
	}

	renderFileTree(parent: HTMLElement, items: GithubTreeItem[], codePanel: HTMLElement, branchSelect: HTMLSelectElement) {
		parent.empty();
		parent.createDiv({ cls: 'pharos-file-tree-header', text: '📁 파일 목록' });

		const grouped: { [key: string]: GithubTreeItem[] } = {};
		const rootFiles: GithubTreeItem[] = [];

		items.forEach(item => {
			const parts = item.path.split('/');
			if (parts.length === 1) rootFiles.push(item);
			else {
				const folder = parts[0] as string;
				if (!grouped[folder]) grouped[folder] = [];
				grouped[folder].push(item);
			}
		});

		rootFiles.forEach(item => this.renderFileItem(parent, item, codePanel, branchSelect));
		Object.entries(grouped).forEach(([folder, files]) => {
			parent.createDiv({ cls: 'pharos-file-item', text: `📁 ${folder}`, attr: { style: 'color:var(--text-muted);font-weight:600;cursor:default;' } });
			files.forEach(item => {
				const el = this.renderFileItem(parent, item, codePanel, branchSelect);
				el.style.paddingLeft = '20px';
			});
		});
	}

	renderFileItem(parent: HTMLElement, item: GithubTreeItem, codePanel: HTMLElement, branchSelect: HTMLSelectElement) {
		const isRecent = this.recentPaths.has(item.path);
		const el = parent.createDiv({ cls: `pharos-file-item${isRecent ? ' recent' : ''}` });
		el.createSpan({ text: getFileIcon(item.path.split('.').pop() || '') + ' ' });
		el.createSpan({ text: item.path.split('/').pop() || item.path });
		if (isRecent) el.createSpan({ cls: 'pharos-recent-badge', text: 'NEW' });

		el.addEventListener('click', async () => {
			parent.querySelectorAll('.pharos-file-item').forEach(e => e.removeClass('active'));
			el.addClass('active');
			await this.loadCodeToPanel(item.path, codePanel, branchSelect.value);
		});
		return el;
	}

	async renderMembersTab(container: HTMLElement) {
		const toolbar = container.createDiv({ cls: 'pharos-toolbar' });
		const rangeSelect = toolbar.createEl('select');
		[{ v: 'week', l: '이번 주' }, { v: 'month', l: '이번 달' }, { v: 'all', l: '전체' }]
			.forEach(o => { const opt = rangeSelect.createEl('option', { text: o.l }); opt.value = o.v; });
		const refreshBtn = toolbar.createEl('button', { text: '🔄' });

		const body = container.createDiv({ cls: 'pharos-body' });
		const memberList = body.createDiv({ cls: 'pharos-member-list' });
		const commitPanel = body.createDiv({ cls: 'pharos-commit-panel' });

		const commitBody = commitPanel.createDiv({ cls: 'pharos-body' });
		const commitList = commitBody.createDiv({ cls: 'pharos-commit-list' });
		const rightPanel = commitBody.createDiv({ cls: 'pharos-body' });
		const fileChangeList = rightPanel.createDiv({ cls: 'pharos-file-change-list' });
		const codePanel = rightPanel.createDiv({ cls: 'pharos-code-panel' });

		const showPlaceholder = (panel: HTMLElement, icon: string, text: string) => {
			panel.empty();
			const ph = panel.createDiv({ cls: 'pharos-placeholder' });
			ph.createDiv({ cls: 'ph-icon', text: icon });
			ph.createDiv({ cls: 'ph-text', text });
		};
		showPlaceholder(commitList, '👆', '팀원을 선택하세요');
		showPlaceholder(fileChangeList, '👆', '커밋을 선택하세요');
		showPlaceholder(codePanel, '👆', '파일을 선택하세요');

		const getSince = (range: string): string | null => {
			const now = new Date();
			if (range === 'week') { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(0, 0, 0, 0); return d.toISOString(); }
			if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
			return null;
		};

		const loadMembers = async () => {
			memberList.empty();
			memberList.createDiv({ cls: 'pharos-section-header', text: '👥 팀원' });
			memberList.createDiv({ cls: 'pharos-loading', text: '불러오는 중...' });
			showPlaceholder(commitList, '👆', '팀원을 선택하세요');
			showPlaceholder(fileChangeList, '👆', '커밋을 선택하세요');
			showPlaceholder(codePanel, '👆', '파일을 선택하세요');

			try {
				const since = getSince(rangeSelect.value);
				const members = await this.plugin.fetchTeamCommits(since);
				memberList.empty();
				memberList.createDiv({ cls: 'pharos-section-header', text: '👥 팀원' });

				if (members.length === 0) {
					memberList.createDiv({ cls: 'pharos-loading', text: '커밋 없음' });
					return;
				}

				members.sort((a, b) => b.commits - a.commits).forEach(member => {
					const el = memberList.createDiv({ cls: 'pharos-member-item' });
					if (member.avatar) {
						const img = el.createEl('img', { cls: 'pharos-member-avatar' });
						img.src = member.avatar;
					} else {
						el.createDiv({ cls: 'pharos-member-avatar', attr: { style: 'background:var(--interactive-accent);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:bold;' }, text: member.author[0]?.toUpperCase() || '?' });
					}
					const info = el.createDiv({ cls: 'pharos-member-info' });
					info.createDiv({ cls: 'pharos-member-name', text: member.author });
					info.createDiv({ cls: 'pharos-member-commits', text: `${member.commits}개 커밋` });

					el.addEventListener('click', async () => {
						memberList.querySelectorAll('.pharos-member-item').forEach(e => e.removeClass('active'));
						el.addClass('active');
						await this.loadMemberCommits(member.author, since, commitList, fileChangeList, codePanel);
					});
				});
			} catch {
				memberList.empty();
				memberList.createDiv({ cls: 'pharos-loading', text: '❌ 로드 실패' });
			}
		};

		refreshBtn.addEventListener('click', loadMembers);
		rangeSelect.addEventListener('change', loadMembers);
		await loadMembers();
	}

	async loadMemberCommits(author: string, since: string | null, commitList: HTMLElement, fileChangeList: HTMLElement, codePanel: HTMLElement) {
		commitList.empty();
		commitList.createDiv({ cls: 'pharos-section-header', text: `📝 ${author}의 커밋` });
		commitList.createDiv({ cls: 'pharos-loading', text: '불러오는 중...' });

		try {
			const commits = await this.plugin.fetchCommitsByAuthor(author, since);
			commitList.empty();
			commitList.createDiv({ cls: 'pharos-section-header', text: `📝 ${author}의 커밋 (${commits.length})` });

			if (commits.length === 0) {
				commitList.createDiv({ cls: 'pharos-loading', text: '커밋 없음' });
				return;
			}

			commits.forEach((commit: CommitItem) => {
				const el = commitList.createDiv({ cls: 'pharos-commit-item' });
				el.createDiv({ cls: 'pharos-commit-msg', text: commit.message });
				el.createDiv({ cls: 'pharos-commit-date', text: formatDate(commit.date) });
				el.createDiv({ cls: 'pharos-commit-sha', text: commit.sha.slice(0, 7) });

				el.addEventListener('click', async () => {
					commitList.querySelectorAll('.pharos-commit-item').forEach(e => e.removeClass('active'));
					el.addClass('active');
					await this.loadCommitFiles(commit.sha, fileChangeList, codePanel);
				});
			});
		} catch {
			commitList.empty();
			commitList.createDiv({ cls: 'pharos-loading', text: '❌ 로드 실패' });
		}
	}

	async loadCommitFiles(sha: string, fileChangeList: HTMLElement, codePanel: HTMLElement) {
		fileChangeList.empty();
		fileChangeList.createDiv({ cls: 'pharos-section-header', text: '📂 변경 파일' });
		fileChangeList.createDiv({ cls: 'pharos-loading', text: '불러오는 중...' });

		codePanel.empty();
		codePanel.createDiv({ cls: 'pharos-placeholder' }).innerHTML = '<div class="ph-icon">👆</div><div class="ph-text">파일을 선택하세요</div>';

		try {
			const files = await this.plugin.fetchCommitFiles(sha);
			fileChangeList.empty();
			fileChangeList.createDiv({ cls: 'pharos-section-header', text: `📂 변경 파일 (${files.length})` });

			files.forEach((file: CommitFile) => {
				const el = fileChangeList.createDiv({ cls: 'pharos-file-change-item' });
				el.createDiv({ cls: 'pharos-file-change-name', text: `${getFileIcon(file.filename.split('.').pop() || '')} ${file.filename.split('/').pop()}` });
				const stat = el.createDiv({ cls: 'pharos-file-change-stat' });
				stat.createSpan({ cls: 'pharos-stat-add', text: `+${file.additions} ` });
				stat.createSpan({ cls: 'pharos-stat-del', text: `-${file.deletions}` });

				el.addEventListener('click', async () => {
					fileChangeList.querySelectorAll('.pharos-file-change-item').forEach(e => e.removeClass('active'));
					el.addClass('active');
					await this.loadCodeToPanel(file.filename, codePanel, sha);
				});
			});
		} catch {
			fileChangeList.empty();
			fileChangeList.createDiv({ cls: 'pharos-loading', text: '❌ 로드 실패' });
		}
	}

	async loadCodeToPanel(path: string, codePanel: HTMLElement, ref: string) {
		codePanel.empty();
		const header = codePanel.createDiv({ cls: 'pharos-code-header' });
		header.createSpan({ text: `📄 ${path}` });
		const copyBtn = header.createEl('button', { cls: 'pharos-copy-btn', text: '복사' });

		const scrollEl = codePanel.createDiv({ cls: 'pharos-code-scroll' });
		scrollEl.createDiv({ cls: 'pharos-loading', text: '불러오는 중...' });

		try {
			const { content } = await this.plugin.fetchFileContent(path, ref);
			scrollEl.empty();
			scrollEl.createEl('pre').setText(content);
			copyBtn.addEventListener('click', () => {
				navigator.clipboard.writeText(content);
				copyBtn.setText('✅ 복사됨');
				setTimeout(() => copyBtn.setText('복사'), 1500);
			});
		} catch {
			scrollEl.empty();
			scrollEl.createDiv({ cls: 'pharos-loading', text: '❌ 파일 로드 실패' });
		}
	}

	async onClose() { }
}

// ============================
// 팀 커밋 현황 모달
// ============================
class TeamCommitModal extends Modal {
	plugin: MyPlugin;
	constructor(app: App, plugin: MyPlugin) { super(app); this.plugin = plugin; }

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: '👥 팀 커밋 현황' });
		contentEl.createEl('style', {
			text: `
			.pharos-tabs { display:flex; gap:4px; margin-bottom:12px; border-bottom:1px solid var(--background-modifier-border); }
			.pharos-tab { padding:6px 14px; cursor:pointer; font-size:13px; border-bottom:2px solid transparent; color:var(--text-muted); }
			.pharos-tab.active { border-bottom-color:var(--interactive-accent); color:var(--text-normal); font-weight:600; }
			.pharos-control-row { display:flex; gap:8px; margin-bottom:10px; align-items:center; }
			.pharos-week-nav { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
			.pharos-week-nav button { padding:3px 10px; cursor:pointer; border-radius:4px; border:1px solid var(--background-modifier-border); background:var(--background-secondary); color:var(--text-normal); }
			.pharos-week-label { font-size:13px; font-weight:600; min-width:180px; text-align:center; }
			.pharos-rank-1 { color:gold; font-weight:bold; }
			.pharos-rank-2 { color:silver; }
			.pharos-rank-3 { color:#cd7f32; }
			table { width:100%; border-collapse:collapse; margin-top:4px; }
			th,td { border:1px solid var(--background-modifier-border); padding:8px 12px; text-align:left; font-size:13px; }
			th { background:var(--background-secondary); }
			tr:hover td { background:var(--background-modifier-hover); }
			.pharos-avatar { width:24px; height:24px; border-radius:50%; vertical-align:middle; }
			.pharos-empty { color:var(--text-muted); padding:20px; text-align:center; }
		`});

		const tabBar = contentEl.createDiv({ cls: 'pharos-tabs' });
		const tabContent = contentEl.createDiv();

		const renderTab = (tabId: string) => {
			tabBar.querySelectorAll('.pharos-tab').forEach(t => t.removeClass('active'));
			tabBar.querySelector(`[data-tab="${tabId}"]`)?.addClass('active');
			tabContent.empty();
			if (tabId === 'period') this.renderPeriodTab(tabContent);
			else this.renderWeeklyTab(tabContent);
		};

		[{ id: 'period', label: '기간별' }, { id: 'weekly', label: '주간별' }].forEach(tab => {
			const el = tabBar.createDiv({ cls: 'pharos-tab', text: tab.label });
			el.setAttribute('data-tab', tab.id);
			el.addEventListener('click', () => renderTab(tab.id));
		});

		tabBar.querySelector('[data-tab="period"]')?.addClass('active');
		this.renderPeriodTab(tabContent);
	}

	renderPeriodTab(container: HTMLElement) {
		const row = container.createDiv({ cls: 'pharos-control-row' });
		const sel = row.createEl('select');
		[{ v: 'today', l: '오늘' }, { v: 'week', l: '이번 주' }, { v: 'month', l: '이번 달' }, { v: 'all', l: '전체' }]
			.forEach(o => { const opt = sel.createEl('option', { text: o.l }); opt.value = o.v; });
		const btn = row.createEl('button', { text: '🔄 새로고침' });
		const tc = container.createDiv();
		const load = async () => {
			tc.empty(); tc.createEl('p', { text: '불러오는 중...', cls: 'pharos-empty' });
			try { this.renderTable(tc, await this.plugin.fetchTeamCommits(this.getSince(sel.value))); }
			catch { tc.createEl('p', { text: '❌ 로드 실패', cls: 'pharos-empty' }); }
		};
		btn.addEventListener('click', load); sel.addEventListener('change', load); load();
	}

	renderWeeklyTab(container: HTMLElement) {
		let offset = 0;
		const nav = container.createDiv({ cls: 'pharos-week-nav' });
		const prev = nav.createEl('button', { text: '◀ 이전 주' });
		const label = nav.createDiv({ cls: 'pharos-week-label' });
		const next = nav.createEl('button', { text: '다음 주 ▶' });
		const tc = container.createDiv();

		const getRange = (o: number) => {
			const now = new Date();
			const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7) + o * 7); mon.setHours(0, 0, 0, 0);
			const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23, 59, 59, 999);
			const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
			return { since: mon.toISOString(), until: sun.toISOString(), label: o === 0 ? `이번 주 (${fmt(mon)}~${fmt(sun)})` : o === -1 ? `저번 주 (${fmt(mon)}~${fmt(sun)})` : `${Math.abs(o)}주 전 (${fmt(mon)}~${fmt(sun)})` };
		};

		const load = async () => {
			const { since, until, label: l } = getRange(offset);
			label.setText(l); (next as HTMLButtonElement).disabled = offset >= 0;
			tc.empty(); tc.createEl('p', { text: '불러오는 중...', cls: 'pharos-empty' });
			try { this.renderTable(tc, await this.plugin.fetchTeamCommits(since, until)); }
			catch { tc.createEl('p', { text: '❌ 로드 실패', cls: 'pharos-empty' }); }
		};

		prev.addEventListener('click', () => { offset--; load(); });
		next.addEventListener('click', () => { if (offset < 0) { offset++; load(); } });
		load();
	}

	getSince(range: string): string | null {
		const now = new Date();
		if (range === 'today') return new Date(now.setHours(0, 0, 0, 0)).toISOString();
		if (range === 'week') { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(0, 0, 0, 0); return d.toISOString(); }
		if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
		return null;
	}

	renderTable(container: HTMLElement, data: CommitData[]) {
		container.empty();
		if (data.length === 0) { container.createEl('p', { text: '커밋 데이터가 없습니다.', cls: 'pharos-empty' }); return; }
		const table = container.createEl('table');
		const hr = table.createEl('thead').createEl('tr');
		['순위', '팀원', '커밋 수'].forEach(h => hr.createEl('th', { text: h }));
		const tbody = table.createEl('tbody');
		const rc = ['pharos-rank-1', 'pharos-rank-2', 'pharos-rank-3'];
		data.sort((a, b) => b.commits - a.commits).forEach((m, i) => {
			const row = tbody.createEl('tr');
			const rank = row.createEl('td', { text: `${i + 1}위` });
			if (i < 3 && rc[i]) rank.addClass(rc[i] as string);
			const td = row.createEl('td');
			const wrap = td.createDiv({ attr: { style: 'display:flex;align-items:center;gap:8px;' } });
			if (m.avatar) { const img = wrap.createEl('img', { cls: 'pharos-avatar' }); img.src = m.avatar; }
			wrap.createSpan({ text: m.author });
			row.createEl('td', { text: `${m.commits}회` });
		});
	}

	onClose() { this.contentEl.empty(); }
}

// ============================
// 타입 / 유틸
// ============================
interface GithubTreeItem { path: string; type: 'blob' | 'tree'; sha: string; }
interface CommitData { author: string; commits: number; avatar: string; }
interface CommitItem { sha: string; message: string; date: string; }
interface CommitFile { filename: string; additions: number; deletions: number; }

function getFileIcon(ext: string) {
	const icons: Record<string, string> = { ts: '🟦', tsx: '🟦', js: '🟨', jsx: '🟨', py: '🐍', java: '☕', kt: '🟣', go: '🐹', rs: '🦀', html: '🌐', css: '🎨', scss: '🎨', json: '📋', yaml: '📋', yml: '📋', md: '📝', txt: '📄', sh: '💻', png: '🖼️', jpg: '🖼️', svg: '🖼️' };
	return icons[ext.toLowerCase()] || '📄';
}

function formatDate(iso: string): string {
	const d = new Date(iso);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ============================
// 메인 플러그인
// ============================
export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();
		this.registerView(CODE_VIEWER_VIEW_TYPE, (leaf) => new CodeViewerView(leaf, this));

		this.addRibbonIcon('cloud', 'Pharos GitHub', (evt) => {
			const menu = new Menu();
			menu.addItem(item => item.setTitle('📂 코드 뷰어 열기').setIcon('code').onClick(() => this.openCodeViewer()));
			menu.addItem(item => item.setTitle('현재 파일 업로드').setIcon('file-up').onClick(async () => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view?.file) { const content = await this.app.vault.read(view.file); await this.uploadToGithub(view.file.name, content); }
				else new Notice('열려있는 노트가 없습니다.');
			}));
			menu.addItem(item => item.setTitle('👥 팀 커밋 현황').setIcon('users').onClick(() => new TeamCommitModal(this.app, this).open()));
			menu.addItem(item => item.setTitle('내 저장소 바로가기').setIcon('external-link').onClick(() => window.open(`https://github.com/${this.settings.userName}/${this.settings.repoName}`)));
			menu.showAtMouseEvent(evt);
		});

		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	async openCodeViewer() {
		const leaves = this.app.workspace.getLeavesOfType(CODE_VIEWER_VIEW_TYPE);
		if (leaves.length > 0 && leaves[0]) { this.app.workspace.revealLeaf(leaves[0]); return; }
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) { await leaf.setViewState({ type: CODE_VIEWER_VIEW_TYPE, active: true }); this.app.workspace.revealLeaf(leaf); }
	}

	async isRepoPrivate(): Promise<boolean> {
		try {
			const res = await requestUrl({
				url: `https://api.github.com/repos/${this.settings.userName}/${this.settings.repoName}`,
				headers: this.githubHeaders()
			});
			return res.status === 200 ? res.json.private === true : false;
		} catch { return false; }
	}

	async fetchBranches() {
		const res = await requestUrl({
			url: `https://api.github.com/repos/${this.settings.userName}/${this.settings.repoName}/branches`,
			headers: this.githubHeaders()
		});
		if (res.status !== 200) throw new Error(`${res.status}`);
		return res.json;
	}

	async fetchFileTree(branch: string): Promise<GithubTreeItem[]> {
		const res = await requestUrl({
			url: `https://api.github.com/repos/${this.settings.userName}/${this.settings.repoName}/git/trees/${branch}?recursive=1`,
			headers: this.githubHeaders()
		});
		if (res.status !== 200) throw new Error(`${res.status}`);
		const data = res.json;
		return (data.tree as GithubTreeItem[]).filter(i => i.type === 'blob' && !i.path.startsWith('.git'));
	}

	async fetchRecentlyChangedFiles(branch: string): Promise<Set<string>> {
		try {
			const res = await requestUrl({
				url: `https://api.github.com/repos/${this.settings.userName}/${this.settings.repoName}/commits?sha=${branch}&per_page=5`,
				headers: this.githubHeaders()
			});
			if (res.status !== 200) return new Set();
			const commits = res.json;
			const paths = new Set<string>();
			for (const c of commits.slice(0, 3)) {
				try {
					const detailRes = await requestUrl({
						url: `https://api.github.com/repos/${this.settings.userName}/${this.settings.repoName}/commits/${c.sha}`,
						headers: this.githubHeaders()
					});
					detailRes.json.files?.forEach((f: { filename: string }) => paths.add(f.filename));
				} catch { }
			}
			return paths;
		} catch { return new Set(); }
	}

	async fetchFileContent(path: string, ref: string) {
		const res = await requestUrl({
			url: `https://api.github.com/repos/${this.settings.userName}/${this.settings.repoName}/contents/${path}?ref=${ref}`,
			headers: this.githubHeaders()
		});
		if (res.status !== 200) throw new Error(`${res.status}`);
		const data = res.json;
		const decoded = decodeURIComponent(atob(data.content.replace(/\s/g, '')).split('').map((c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
		return { content: decoded };
	}

	async fetchCommitsByAuthor(author: string, since: string | null): Promise<CommitItem[]> {
		const target = this.settings.teamRepo || this.settings.repoName;
		let url = `https://api.github.com/repos/${this.settings.userName}/${target}/commits?author=${author}&per_page=50`;
		if (since) url += `&since=${since}`;
		const res = await requestUrl({ url, headers: this.githubHeaders() });
		if (res.status !== 200) throw new Error(`${res.status}`);
		return res.json.map((c: any) => ({
			sha: c.sha,
			message: c.commit.message.split('\n')[0],
			date: c.commit.author.date,
		}));
	}

	async fetchCommitFiles(sha: string): Promise<CommitFile[]> {
		const target = this.settings.teamRepo || this.settings.repoName;
		const res = await requestUrl({
			url: `https://api.github.com/repos/${this.settings.userName}/${target}/commits/${sha}`,
			headers: this.githubHeaders()
		});
		if (res.status !== 200) throw new Error(`${res.status}`);
		const data = res.json;
		return (data.files || []).map((f: any) => ({
			filename: f.filename,
			additions: f.additions,
			deletions: f.deletions,
		}));
	}

	async fetchTeamCommits(since: string | null, until?: string): Promise<CommitData[]> {
		const target = this.settings.teamRepo || this.settings.repoName;
		let url = `https://api.github.com/repos/${this.settings.userName}/${target}/commits?per_page=100`;
		if (since) url += `&since=${since}`;
		if (until) url += `&until=${until}`;
		const res = await requestUrl({ url, headers: this.githubHeaders() });
		if (res.status !== 200) throw new Error(`${res.status}`);
		const commits = res.json;
		const map: Record<string, { commits: number; avatar: string }> = {};
		commits.forEach((c: any) => {
			const author = c.author?.login || c.commit?.author?.name || 'unknown';
			const avatar = c.author?.avatar_url || '';
			if (!map[author]) map[author] = { commits: 0, avatar };
			map[author].commits++;
		});
		return Object.entries(map).map(([author, v]) => ({ author, commits: v.commits, avatar: v.avatar }));
	}

	async uploadToGithub(fileName: string, content: string) {
		const url = `https://api.github.com/repos/${this.settings.userName}/${this.settings.repoName}/contents/${fileName}`;
		try {
			const check = await requestUrl({ url, headers: this.githubHeaders() });
			const sha = check.status === 200 ? check.json.sha : null;
			const res = await requestUrl({
				url,
				method: 'PUT',
				headers: { ...this.githubHeaders(), 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: `Update ${fileName} via Pharos`, content: btoa(unescape(encodeURIComponent(content))), sha })
			});
			if (res.status === 200 || res.status === 201) new Notice('업로드 성공! 🎉'); else new Notice('업로드 실패');
		} catch { new Notice('네트워크 오류'); }
	}

	private githubHeaders(): Record<string, string> {
		const h: Record<string, string> = {
			'Accept': 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28'
		};
		if (this.settings.ghToken) h['Authorization'] = `Bearer ${this.settings.ghToken}`;
		return h;
	}

	async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
	async saveSettings() { await this.saveData(this.settings); }
}