# AI_RULES.md - Manipularium Conferência Bancária

Este documento define a pilha de tecnologia e regras para desenvolvimento e manutenção do aplicativo de Conferência Bancária Manipularium.

## Pilha de Tecnologia

### 1. Frontend Framework
- **React 18.3.1** - Framework principal para interface do usuário
- **TypeScript** - Linguagem primária para type safety
- **Vite** - Build tool e development server

### 2. Styling e UI
- **Tailwind CSS** - Framework CSS utility-first
- **Lucide React** - Biblioteca de ícones (única biblioteca de ícones permitida)
- **Responsive Design** - Mobile-first approach obrigatório

### 3. Roteamento e Navegação
- **React Router DOM v7** - Roteamento client-side
- **Protected Routes** - Controle de acesso baseado em autenticação

### 4. Gerenciamento de Estado
- **React Context API** - Para estado global (AuthContext)
- **React Hooks** - useState, useEffect, useReducer para estado local
- **Custom Hooks** - Para lógica reutilizável

### 5. Autenticação e Backend
- **Supabase** - Backend-as-a-Service principal
- **PostgreSQL** - Database através do Supabase
- **Row Level Security (RLS)** - Segurança no nível de linha obrigatória

### 6. Armazenamento Local
- **Dexie.js** - Wrapper para IndexedDB (armazenamento offline)
- **IndexedDB** - Storage principal para dados offline
- **LocalStorage/SessionStorage** - Apenas para configurações simples

### 7. Formulários e Validação
- **React Hook Form** - Gerenciamento de formulários
- **Zod** - Schema validation e type inference
- **@hookform/resolvers** - Integração Hook Form + Zod

### 8. Processamento de Dados
- **XLSX** - Leitura e escrita de arquivos Excel
- **Web Workers** - Processamento assíncrono de planilhas
- **Comlink** - Comunicação com Web Workers

### 9. Testes
- **Vitest** - Framework de testes unitários
- **@testing-library/react** - Testes de componentes React
- **Playwright** - Testes end-to-end
- **Happy DOM/JSDOM** - DOM environment para testes

### 10. Performance e UX
- **React Window** - Virtualização de listas grandes
- **React Hot Toast** - Notificações toast
- **Custom Performance Logger** - Monitoramento de performance

## Regras de Desenvolvimento

### Bibliotecas e Dependências

#### ✅ SEMPRE USAR
- **React 18** - Framework principal
- **TypeScript** - Tipagem obrigatória
- **Tailwind CSS** - Estilização exclusiva
- **Supabase Client** - Integração com backend
- **React Hook Form + Zod** - Formulários e validação
- **Dexie** - Armazenamento IndexedDB
- **Lucide React** - Ícones

#### ⚠️ USAR COM CUIDADO
- **External APIs** - Sempre validar dados externos
- **Heavy Libraries** - Avaliar impacto no bundle size
- **Direct DOM Manipulation** - Preferir React patterns

#### ❌ NUNCA USAR
- **jQuery** - Conflita com React
- **Bootstrap/Material-UI** - Conflita com Tailwind
- **Outras bibliotecas de ícones** - Usar apenas Lucide React
- **localStorage para dados sensíveis** - Usar Supabase
- **Inline styles** - Usar classes Tailwind

### Estrutura de Arquivos

```
src/
├── components/          # Componentes React reutilizáveis
├── pages/              # Páginas principais da aplicação
├── hooks/              # Custom React hooks
├── contexts/           # React Context providers
├── services/           # Lógica de negócio e API calls
├── utils/              # Funções utilitárias
├── lib/                # Configurações de bibliotecas
├── types/              # Definições TypeScript
├── workers/            # Web Workers
└── test/               # Configurações de teste
```

### Padrões de Código

#### Componentes React
```typescript
// ✅ Correto
interface ComponentProps {
  data: DataType;
  onAction: (id: string) => void;
}

export function Component({ data, onAction }: ComponentProps) {
  // Component logic
}

// ❌ Incorreto
export default function Component(props: any) {
  // Component logic
}
```

#### Hooks Customizados
```typescript
// ✅ Correto
export function useCustomHook(param: string) {
  const [state, setState] = useState<StateType>();

  return { state, setState };
}
```

#### Serviços e APIs
```typescript
// ✅ Correto
export class DataService {
  static async getData(): Promise<DataType[]> {
    // Implementation
  }
}

// ❌ Incorreto - usar classes para serviços
export const getData = async () => {
  // Implementation
}
```

### Regras de Performance

1. **Virtualização obrigatória** para listas com mais de 100 itens
2. **Web Workers** para processamento pesado (>50ms)
3. **Lazy loading** para componentes grandes
4. **Memoização** com React.memo quando apropriado
5. **Bundle splitting** para código de terceiros

### Regras de Segurança

1. **Validação Zod** obrigatória para todos os inputs
2. **Sanitização** de dados antes de renderização
3. **Environment variables** para configurações sensíveis
4. **RLS policies** no Supabase para proteção de dados
5. **HTTPS apenas** em produção

### Regras de Teste

1. **Cobertura mínima de 85%** para statements, branches, functions e lines
2. **Testes unitários** para todas as utilities e hooks
3. **Testes de integração** para serviços
4. **Testes E2E** para fluxos críticos
5. **Mock de APIs externas** obrigatório

### Deployment e Build

1. **Build via Vite** exclusivamente
2. **TypeScript strict mode** habilitado
3. **ESLint** para quality assurance
4. **Tree shaking** para otimização de bundle
5. **Environment específicos** para dev/staging/prod

### Regras de Versionamento

1. **Semantic Versioning** (semver)
2. **Commits convencionais** (conventional commits)
3. **Branch protection** na branch main
4. **Code review** obrigatório para PRs
5. **Automated testing** antes de merge

## Contato para Dúvidas

Para questões sobre arquitetura ou decisões técnicas, consulte este documento primeiro. Para alterações na pilha de tecnologia, discussão prévia é obrigatória.

---

**Última atualização**: 2025-01-21
**Versão**: 1.0.0