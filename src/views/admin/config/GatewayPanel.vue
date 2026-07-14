<script setup lang="ts">
import { computed, ref } from 'vue'
import { ApiError } from '@/api/client'
import * as settingsApi from '@/api/settings'
import type { GatewaySettings } from '@/api/settings'
import { useToast } from '@/composables/useToast'
import { copyToClipboard } from '@/utils/clipboard'

type GatewaySubTab = 'general' | 'webdav' | 'smb' | 'ftp' | 'sftp' | 's3' | 'nfs'

const toast = useToast()
const form = defineModel<GatewaySettings>({ required: true })
const saving = ref(false)
const subTab = ref<GatewaySubTab>('general')

const host = computed(() => (form.value.public_host || window.location.hostname || '127.0.0.1').trim())

const webdavURL = computed(() => `http://${host.value}:${form.value.webdav.port || 8082}/`)
const smbPath = computed(() => `\\\\${host.value}\\${form.value.smb.share_name || 'nextfile'}`)
const smbURL = computed(() => `smb://${host.value}/${form.value.smb.share_name || 'nextfile'}`)
const ftpURL = computed(() => `ftp://${host.value}:${form.value.ftp.port || 2121}/`)
const sftpURL = computed(() => `sftp://${host.value}:${form.value.sftp.port || 2222}/`)
const s3URL = computed(() => `http://${host.value}:${form.value.s3.port || 9000}`)
const nfsMountLinux = computed(() => {
  const port = form.value.nfs.port || 2049
  return [
    'sudo mkdir -p /tmp/mnt &&',
    `sudo mount -t nfs -o port=${port},mountport=${port},nfsvers=3,tcp,nolock \\`,
    `  ${host.value}:/ /tmp/mnt`,
  ].join('\n')
})
const nfsMountMac = computed(() => {
  const port = form.value.nfs.port || 2049
  return [
    'sudo mkdir -p /tmp/mnt &&',
    `sudo mount -t nfs -o port=${port},mountport=${port},nfsvers=3,tcp,noacl,nolock,resvport \\`,
    `  ${host.value}:/ /tmp/mnt`,
  ].join('\n')
})

const tabs = computed(() => [
  { id: 'general' as const, label: '概况', enabled: form.value.enabled },
  { id: 'webdav' as const, label: 'WebDAV', enabled: form.value.webdav.enabled },
  { id: 'smb' as const, label: 'SMB', enabled: form.value.smb.enabled },
  { id: 'ftp' as const, label: 'FTP', enabled: form.value.ftp.enabled },
  { id: 'sftp' as const, label: 'SFTP', enabled: form.value.sftp.enabled },
  { id: 's3' as const, label: 'S3', enabled: form.value.s3.enabled },
  { id: 'nfs' as const, label: 'NFS', enabled: form.value.nfs.enabled },
])

async function save() {
  saving.value = true
  try {
    form.value = await settingsApi.saveSettings('gateway', form.value)
    toast.show('对外服务配置已保存（协议监听即时重载）')
  } catch (e) {
    toast.show(e instanceof ApiError ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function copy(text: string) {
  const ok = await copyToClipboard(text)
  toast.show(ok ? '已复制' : '复制失败，请手动选择复制')
}
</script>

<style scoped>
.cd-gateway-help {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.4rem;
}
.cd-gateway-help :deep(code) {
  white-space: pre-wrap;
  word-break: break-all;
}
.cd-gateway-help__line {
  display: block;
  line-height: 1.5;
}
.cd-gateway-cmd {
  display: block;
  margin-top: 0.35rem;
  padding: 0.5rem 0.65rem;
  border-radius: 0.375rem;
  background: rgba(0, 0, 0, 0.04);
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 0.8125rem;
  line-height: 1.45;
}
</style>

<template>
  <div class="cd-settings-panel">
    <h3 class="cd-settings-panel-title">对外网关服务</h3>
    <p class="text-secondary small mb-3">
      应用本身提供 REST API（JWT / 个人访问令牌 + PathACL）。此处可额外开启嵌入式 WebDAV / FTP / SFTP / S3，以及 SMB / NFS
      共享导出。Windows 优先 SMB，其次 WebDAV 映射网络驱动器；脚本与自动化优先 REST 或 S3。
    </p>

    <ul class="nav nav-tabs cd-cloud-subtabs mb-4">
      <li v-for="tab in tabs" :key="tab.id" class="nav-item">
        <button
          type="button"
          class="nav-link d-inline-flex align-items-center gap-2"
          :class="{ active: subTab === tab.id }"
          @click="subTab = tab.id"
        >
          {{ tab.label }}
          <span
            class="badge rounded-pill"
            :class="tab.enabled ? 'bg-green-lt text-green' : 'bg-secondary-lt text-secondary'"
          >
            {{ tab.enabled ? '已启用' : '未启用' }}
          </span>
        </button>
      </li>
    </ul>

    <!-- 概况 -->
    <div v-if="subTab === 'general'">
      <label class="form-check form-switch mb-3">
        <input v-model="form.enabled" class="form-check-input" type="checkbox" />
        <span class="form-check-label">启用对外网关</span>
      </label>
      <label class="form-check form-switch mb-4">
        <input v-model="form.personal_tokens_enabled" class="form-check-input" type="checkbox" />
        <span class="form-check-label">启用个人访问令牌（Profile / REST / S3）</span>
      </label>

      <div class="row g-3 mb-4">
        <div class="col-md-8">
          <label class="form-label">对外主机名 / IP</label>
          <input v-model="form.public_host" class="form-control" :placeholder="host" />
          <div class="form-hint">
            填写客户端可达的公网 IP、局域网 IP 或域名。Docker / NAT 下 FTP 被动模式（PASV）必须填此项，否则会通告容器内网地址。
          </div>
        </div>
        <div class="col-md-4">
          <label class="form-label">默认存储 ID（0=本地默认）</label>
          <input v-model.number="form.default_storage_id" type="number" min="0" class="form-control" />
        </div>
      </div>

      <div class="alert alert-warning small mb-0">
        <strong>guest 账号：</strong>系统种子用户 <code>guest</code>（默认密码 <code>guest</code> /
        <code>DEFAULT_GUEST_PASSWORD</code>），禁止 Web 登录。可由管理员在用户管理中代发个人访问令牌。
      </div>
    </div>

    <!-- WebDAV -->
    <div v-else-if="subTab === 'webdav'">
      <label class="form-check form-switch mb-3">
        <input v-model="form.webdav.enabled" class="form-check-input" type="checkbox" />
        <span class="form-check-label">启用 WebDAV</span>
      </label>
      <div class="row g-3 mb-3">
        <div class="col-md-4">
          <label class="form-label">端口</label>
          <input v-model.number="form.webdav.port" type="number" class="form-control" />
        </div>
        <div class="col-md-4">
          <label class="form-label">监听地址</label>
          <input v-model="form.webdav.listen" class="form-control" placeholder="0.0.0.0" />
        </div>
      </div>
      <div class="alert alert-info small mb-0 cd-gateway-help">
        <div class="cd-gateway-help__line fw-medium">Windows 资源管理器 · 映射网络驱动器</div>
        <div class="cd-gateway-help__line">此电脑 → 映射网络驱动器 → 「连接使用不同凭据的网站」</div>
        <div class="cd-gateway-help__line">
          地址：
          <code>{{ webdavURL }}</code>
          <button type="button" class="btn btn-link btn-sm p-0 ms-1" @click="copy(webdavURL)">复制</button>
        </div>
        <div class="cd-gateway-help__line">用户名/密码为 NextFile 账号（可用 guest）</div>
        <div class="cd-gateway-help__line text-secondary">
          建议仅内网或配合 TLS；Windows WebClient 需要 Basic Auth。
        </div>
      </div>
    </div>

    <!-- SMB -->
    <div v-else-if="subTab === 'smb'">
      <label class="form-check form-switch mb-3">
        <input v-model="form.smb.enabled" class="form-check-input" type="checkbox" />
        <span class="form-check-label">启用内嵌 SMB2（进程内，无需 Docker）</span>
      </label>
      <div class="row g-3 mb-3">
        <div class="col-md-3">
          <label class="form-label">端口</label>
          <input v-model.number="form.smb.port" type="number" class="form-control" />
        </div>
        <div class="col-md-3">
          <label class="form-label">监听地址</label>
          <input v-model="form.smb.listen" class="form-control" placeholder="0.0.0.0" />
        </div>
        <div class="col-md-3">
          <label class="form-label">共享名</label>
          <input v-model="form.smb.share_name" class="form-control" />
        </div>
      </div>
      <div class="alert alert-success small mb-0 cd-gateway-help">
        <div class="cd-gateway-help__line">
          连接地址（必须带共享名）：
          <code>{{ smbPath }}</code>
          <button type="button" class="btn btn-link btn-sm p-0 ms-1" @click="copy(smbPath)">复制</button>
        </div>
        <div class="cd-gateway-help__line">
          macOS Finder：
          <code>{{ smbURL }}</code>
          <button type="button" class="btn btn-link btn-sm p-0 ms-1" @click="copy(smbURL)">复制</button>
        </div>
        <div class="cd-gateway-help__line text-secondary">
          使用<strong>管理后台用户</strong>（如 admin）的用户名和密码登录；不再使用访客
        </div>
        <div class="cd-gateway-help__line text-secondary">
          <strong>macOS</strong>：Finder → 连接服务器 →
          <code>smb://主机/nextfile</code> → 注册用户
        </div>
        <div class="cd-gateway-help__line text-secondary">
          <strong>Windows</strong>：
          <code>\\主机\nextfile</code>，输入系统用户名密码
        </div>
        <div class="cd-gateway-help__line text-secondary">
          若提示密码错误：请在后台重置一次该用户密码（或先 Web 登录一次），以生成 SMB 所需凭据
        </div>
      </div>
    </div>

    <!-- FTP -->
    <div v-else-if="subTab === 'ftp'">
      <label class="form-check form-switch mb-3">
        <input v-model="form.ftp.enabled" class="form-check-input" type="checkbox" />
        <span class="form-check-label">启用 FTP</span>
      </label>
      <div class="row g-3 mb-3">
        <div class="col-md-3">
          <label class="form-label">控制端口</label>
          <input v-model.number="form.ftp.port" type="number" class="form-control" />
        </div>
        <div class="col-md-3">
          <label class="form-label">监听地址</label>
          <input v-model="form.ftp.listen" class="form-control" placeholder="0.0.0.0" />
        </div>
        <div class="col-md-3">
          <label class="form-label">PASV 端口起</label>
          <input v-model.number="form.ftp.pasv_min_port" type="number" class="form-control" placeholder="2122" />
        </div>
        <div class="col-md-3">
          <label class="form-label">PASV 端口止</label>
          <input v-model.number="form.ftp.pasv_max_port" type="number" class="form-control" placeholder="2131" />
        </div>
      </div>
      <div class="alert alert-secondary small mb-0 cd-gateway-help">
        <div class="cd-gateway-help__line">
          连接：
          <code>{{ ftpURL }}</code>
          <button type="button" class="btn btn-link btn-sm p-0 ms-1" @click="copy(ftpURL)">复制</button>
        </div>
        <div class="cd-gateway-help__line text-secondary">
          Windows「网络」邻居体验较差，建议用 WinSCP / FileZilla；主推 SMB / WebDAV。
        </div>
        <div v-if="!form.public_host?.trim()" class="cd-gateway-help__line text-warning">
          未填写「对外主机名 / IP」时，PASV 可能返回内网地址。请到「概况」填写公网 IP（如 {{ host }}）。
        </div>
        <div class="cd-gateway-help__line text-secondary">
          被动模式会使用 PASV 端口范围（默认 2122–2131）。云安全组与 Docker 需同时放行控制端口与该范围，否则登录成功但列目录超时。
        </div>
      </div>
    </div>

    <!-- SFTP -->
    <div v-else-if="subTab === 'sftp'">
      <label class="form-check form-switch mb-3">
        <input v-model="form.sftp.enabled" class="form-check-input" type="checkbox" />
        <span class="form-check-label">启用 SFTP</span>
      </label>
      <div class="row g-3 mb-3">
        <div class="col-md-4">
          <label class="form-label">端口</label>
          <input v-model.number="form.sftp.port" type="number" class="form-control" />
        </div>
        <div class="col-md-4">
          <label class="form-label">监听地址</label>
          <input v-model="form.sftp.listen" class="form-control" placeholder="0.0.0.0" />
        </div>
      </div>
      <div class="alert alert-secondary small mb-0 cd-gateway-help">
        <div class="cd-gateway-help__line">
          连接：
          <code>{{ sftpURL }}</code>
          <button type="button" class="btn btn-link btn-sm p-0 ms-1" @click="copy(sftpURL)">复制</button>
        </div>
        <div class="cd-gateway-help__line text-secondary">
          使用 WinSCP / FileZilla / rclone；账号密码与 NextFile 用户一致。
        </div>
        <div class="cd-gateway-help__line text-secondary">
          FileZilla 协议请选
          <strong>SFTP - SSH File Transfer Protocol</strong>
          （不要选 FTP），端口默认 2222（FTP 为 2121）。
        </div>
      </div>
    </div>

    <!-- S3 -->
    <div v-else-if="subTab === 's3'">
      <label class="form-check form-switch mb-3">
        <input v-model="form.s3.enabled" class="form-check-input" type="checkbox" />
        <span class="form-check-label">启用 S3 兼容 API</span>
      </label>
      <div class="row g-3 mb-3">
        <div class="col-md-4">
          <label class="form-label">端口</label>
          <input v-model.number="form.s3.port" type="number" class="form-control" />
        </div>
        <div class="col-md-4">
          <label class="form-label">监听地址</label>
          <input v-model="form.s3.listen" class="form-control" placeholder="0.0.0.0" />
        </div>
      </div>
      <div class="alert alert-secondary small mb-0 cd-gateway-help">
        <div class="cd-gateway-help__line">
          Endpoint：
          <code>{{ s3URL }}</code>
          <button type="button" class="btn btn-link btn-sm p-0 ms-1" @click="copy(s3URL)">复制</button>
        </div>
        <div class="cd-gateway-help__line">
          Access Key 可用个人令牌 <code>nf_…</code>（Header <code>X-API-Key</code> / Bearer）
        </div>
        <div class="cd-gateway-help__line">或账号作 Access Key，密码放 <code>X-Nextfile-Secret</code></div>
        <div class="cd-gateway-help__line">Bucket 名默认 <code>nextfile</code>，对象路径对应虚拟目录</div>
      </div>
    </div>

    <!-- NFS -->
    <div v-else-if="subTab === 'nfs'">
      <label class="form-check form-switch mb-3">
        <input v-model="form.nfs.enabled" class="form-check-input" type="checkbox" />
        <span class="form-check-label">启用内嵌 NFSv3（进程内，无需 Docker）</span>
      </label>
      <div class="row g-3 mb-3">
        <div class="col-md-3">
          <label class="form-label">端口</label>
          <input v-model.number="form.nfs.port" type="number" class="form-control" />
        </div>
        <div class="col-md-3">
          <label class="form-label">监听地址</label>
          <input v-model="form.nfs.listen" class="form-control" placeholder="0.0.0.0" />
        </div>
        <div class="col-md-6">
          <label class="form-label">导出目录（空=默认本地存储根）</label>
          <input
            v-model="form.nfs.export_path"
            class="form-control"
            placeholder="留空自动使用本地存储 base_path"
          />
          <div class="form-hint">
            须为<strong>本机已存在的目录</strong>。Docker 内常见
            <code>/data/files</code>；直接跑二进制时勿填容器路径，否则挂载会报 No such file or directory。
          </div>        </div>
      </div>
      <div class="alert alert-secondary small mb-0 cd-gateway-help">
        <div class="cd-gateway-help__line">
          <span class="fw-medium">Linux：</span>
          <button type="button" class="btn btn-link btn-sm p-0 ms-1" @click="copy(nfsMountLinux)">复制</button>
        </div>
        <code class="cd-gateway-cmd user-select-all">{{ nfsMountLinux }}</code>
        <div class="cd-gateway-help__line">
          <span class="fw-medium">macOS：</span>
          <button type="button" class="btn btn-link btn-sm p-0 ms-1" @click="copy(nfsMountMac)">复制</button>
        </div>
        <code class="cd-gateway-cmd user-select-all">{{ nfsMountMac }}</code>
        <div class="cd-gateway-help__line text-secondary">
          Linux 需先安装客户端：
          <code>sudo apt install nfs-common</code>
          （Debian/Ubuntu）或
          <code>sudo dnf install nfs-utils</code>
          （RHEL/Fedora）；缺少 <code>mount.nfs</code> 会报 wrong fs type / helper program
        </div>
        <div class="cd-gateway-help__line text-secondary">
          客户端路径固定为 <code>/</code>（上方「导出目录」是服务端磁盘路径，不要写成
          <code>host:/data/files</code>）
        </div>
        <div class="cd-gateway-help__line text-secondary">
          云安全组放行 TCP <code>2049</code>；MOUNT 与 NFS 共用该端口
        </div>
      </div>
    </div>

    <div class="cd-settings-actions">
      <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
        {{ saving ? '保存中…' : '保存' }}
      </button>
    </div>
  </div>
</template>
