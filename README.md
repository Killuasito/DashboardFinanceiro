# Jordino

Uma aplicação moderna de painel financeiro construída com Next.js, React e Firebase. Jordino oferece aos usuários uma visão abrangente de suas contas financeiras, transações e análises através de uma interface web intuitiva.

## Funcionalidades

- 🔐 Autenticação de Usuário (Cadastro/Login com Firebase)
- 📊 Painel Financeiro com Gráficos e Análises
- 💳 Gerenciamento de Contas
- 💰 Rastreamento de Transações
- 📱 Design Responsivo com Tailwind CSS
- 🎨 Interface Moderna com React Icons

## Pilha Tecnológica

- **Frontend**: Next.js 16, React 19, TypeScript
- **Estilização**: Tailwind CSS 4
- **Backend**: Firebase (Autenticação & Firestore)
- **Gráficos**: Recharts
- **Ícones**: React Icons
- **Linting**: ESLint

## Pré-requisitos

- Node.js (versão 18 ou superior)
- npm ou yarn ou pnpm

## Instalação

1. Clone o repositório:
   ```bash
   git clone <repository-url>
   cd jordino
   ```

2. Instale as dependências:
   ```bash
   npm install
   # ou
   yarn install
   # ou
   pnpm install
   ```

3. Configure as variáveis de ambiente:
   Crie um arquivo `.env.local` no diretório raiz e adicione sua configuração do Firebase:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=sua_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=seu_messaging_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=seu_app_id
   OPENROUTER_API_KEY=sua_chave_openrouter
   ```

   Você pode encontrar esses valores nas configurações do seu projeto Firebase.

      Para habilitar o chatbot financeiro (modelo deepseek/deepseek-r1-0528:free via OpenRouter), defina `OPENROUTER_API_KEY` com um token válido do OpenRouter com permissão para esse modelo.

## Uso

1. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

2. Abra [http://localhost:3000](http://localhost:3000) no seu navegador.

3. Cadastre-se para uma nova conta ou faça login com credenciais existentes.

## Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Compila a aplicação para produção
- `npm run start` - Inicia o servidor de produção
- `npm run lint` - Executa o ESLint para verificação de código

## Estrutura do Projeto

```
jordino/
├── app/                    # Diretório da aplicação Next.js
│   ├── dashboard/         # Páginas do painel
│   └── globals.css        # Estilos globais
├── components/            # Componentes React
│   ├── AuthProvider.tsx   # Contexto de autenticação
│   ├── DashboardHome.tsx  # Componente principal do painel
│   └── ...
├── lib/                   # Bibliotecas utilitárias
│   └── firebase.ts        # Configuração do Firebase
├── types/                 # Definições de tipos TypeScript
└── public/                # Assets estáticos
```

## Implantação

A maneira mais fácil de implantar esta aplicação é usando o [Vercel](https://vercel.com):

1. Envie seu código para um repositório Git (GitHub, GitLab, etc.)
2. Conecte seu repositório ao Vercel
3. Adicione suas variáveis de ambiente no painel do Vercel
4. Implante!

Para outras opções de implantação, consulte a [documentação de implantação do Next.js](https://nextjs.org/docs/app/building-your-application/deploying).

## Contribuição

1. Faça um fork do repositório
2. Crie uma branch de funcionalidade (`git checkout -b feature/recurso-incrivel`)
3. Faça commit das suas alterações (`git commit -m 'Adiciona um recurso incrível'`)
4. Envie para a branch (`git push origin feature/recurso-incrivel`)
5. Abra um Pull Request

## Licença

Este projeto é privado e proprietário.

## Saiba Mais

- [Documentação do Next.js](https://nextjs.org/docs)
- [Documentação do Firebase](https://firebase.google.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Recharts](https://recharts.org/)
