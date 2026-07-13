export interface StorageConfig {
  base_path?: string
  endpoint?: string
  bucket?: string
  access_key?: string
  secret_key?: string
  region?: string
  use_ssl?: boolean
  prefix?: string
  host?: string
  port?: number
  username?: string
  password?: string
  url?: string
  server?: string
  export?: string
  mount_point?: string
  sub_path?: string
  version?: number
  options?: string
  share?: string
  domain?: string
  remote_path?: string
  connected?: boolean
  account_name?: string
  token_expiry?: string
  oauth_scope?: string
}

export interface StorageRow {
  id: string
  name: string
  driver: string
  root_path: string
  access_root_path?: string
  enabled: boolean
  remark?: string
  config?: StorageConfig
}

export interface FileEntry {
  id: string
  name: string
  path: string
  isDir: boolean
  size: number
  modified: string
  mimeType?: string
}
