import { NextResponse } from 'next/server';

const MODEL_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL_ID = 'deepseek/deepseek-r1-0528:free';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AdvisorContext {
  accountName?: string;
  accountBalance?: number;
  totalIncome?: number;
  totalExpense?: number;
  recentTransactions?: Array<{
    date: string;
    type: string;
    category: string;
    amount: number;
    description?: string;
  }>;
}

function buildPrompt(messages: ChatMessage[], context?: AdvisorContext) {
  const contextSection = context
    ? `Contexto financeiro atual:\n${JSON.stringify(context, null, 2)}`
    : 'Sem dados financeiros adicionais.';

  const conversation = messages
    .map((msg) => `${msg.role === 'assistant' ? 'Assistente' : 'Usuário'}: ${msg.content}`)
    .join('\n');

  return `Você é um consultor financeiro em português. Use os dados fornecidos para sugerir economia, reequilíbrio de orçamento e próximos passos práticos. Evite respostas genéricas e proponha valores, percentuais ou cortes concretos. Se faltar dado, faça perguntas objetivas.\n\n${contextSection}\n\nHistórico de conversa:\n${conversation}\n\nResposta em tom direto e curto:`;
}

export async function POST(request: Request) {
  const token = process.env.OPENROUTER_API_KEY;

  if (!token) {
    return NextResponse.json(
      { error: 'Configure a variável de ambiente OPENROUTER_API_KEY para habilitar o assistente.' },
      { status: 500 }
    );
  }

  try {
    const { messages, context }: { messages: ChatMessage[]; context?: AdvisorContext } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Nenhuma mensagem recebida.' }, { status: 400 });
    }

    const systemContent = buildPrompt(messages, context);
    const chatMessages = [
      { role: 'system', content: systemContent },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const response = await fetch(MODEL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: chatMessages,
        max_tokens: 400,
        temperature: 0.35,
        top_p: 0.9,
        repetition_penalty: 1.05,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Falha ao consultar o modelo: ${response.status} ${errorText}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content ?? '';

    if (!reply) {
      return NextResponse.json(
        { error: 'Não foi possível gerar a resposta do modelo.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Erro no endpoint de IA:', error);
    return NextResponse.json({ error: 'Erro interno ao processar a solicitação.' }, { status: 500 });
  }
}
