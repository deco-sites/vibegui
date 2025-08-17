# Descobrindo um Workflow de Desenvolvimento Autônomo: Domingo de Vibecoding com Claude Code

**Data:** 17 de Agosto, 2025  
**Autor:** Guilherme Rodrigues  
**Contexto:** Como vocês sabem, estamos construindo um Context Management System para gerenciar MCPs, agents e workflows.

---

## O que descobri hoje

Passei o domingo inteiro codando com o Claude Code e chegamos numa coisa bem interessante. Começamos com um monte de scripts soltos e terminamos com um sistema onde o Claude consegue:

1. **Escrever workflows** usando nosso framework
2. **Fazer deploy instantâneo** via hot reload  
3. **Executar e debugar** através de ferramentas MCP
4. **Corrigir erros sozinho** e verificar se funcionou
5. **Tudo isso sem sair da interface do Claude Code**

Vou contar como chegamos nisso e por que é tão legal.

---

## O contexto: Meu blog precisa de tradução automática

Estou fazendo meu blog pessoal, vibegui.com, e a feature principal dele é que vai ser **generative-translated por AI** sempre que um usuário pedir uma língua nova. 

**Como vai funcionar:** Usuário entra no blog, não tem a tradução que ele quer daquele artigo → sistema traduz automaticamente usando workflow e salva no banco.

**O problema que tive ontem:** Estava pegando meus posts do LinkedIn e trazendo pro filesystem, mas decidi hoje que quero tudo no banco de dados do nosso workspace do deco CMS, porque vai ser dinâmico.

**O problema imediato:** Tinha muito post sem title e excerpt. Precisava passar por todos, um a um, gerar title/excerpt, botar no banco. Era muito trabalho manual.

## A evolução: De scripts para MCP integration

### Primeira tentativa: Template do Camudo
Comecei rodando nosso template de MCP do Camudo. Funcionou bem, mas **eu não conseguia acessar o MCP do Claude Code**.

### Segunda tentativa: Scripts que acessam MCP
Como não conseguia conectar direto, mandei o Claude fazer scripts que acessavam o MCP para chamar as coisas:

```bash
# Scripts que eu tinha que rodar manualmente
node process-all-blog-posts.js
node check-workflow-status.js
node debug-workflow.js
```

Funcionava, mas era lento e manual. O Claude não conseguia iterar sozinho nos workflows.

### Breakthrough: HTTP transport fixando a porta
Finalmente consegui! O segredo foi usar `claude mcp add` com **transport HTTP** e **fixando a porta 3000**. 

Agora o Claude consegue sempre:
1. Rodar meu servidor local
2. Adicionar as ferramentas no MCP automaticamente
3. Acessar os workflows direto da interface

---

## O que conseguimos hoje: Ciclo perfeito de vibecoding

Com a conexão HTTP funcionando, de repente o Claude Code conseguia ver e usar todas as ferramentas:

```typescript
// Ferramentas MCP que o Claude consegue usar agora
mcp__vibegui-blog__DECO_CHAT_WORKFLOWS_START_PROCESS_BLOG_POST  // Processar posts
mcp__vibegui-blog__WORKFLOW_STATUS                              // Checar status  
mcp__vibegui-blog__LIST_WORKFLOW_RUNS                          // Debugar runs
mcp__vibegui-blog__INSERT_BLOG_POST                             // Salvar no banco
mcp__vibegui-blog__GENERATE_TITLE_EXCERPT                       // Gerar title/excerpt
```

Isso mudou tudo porque agora **o Claude Code consegue interagir direto com nossos workflows**. Sem mais execução manual de scripts, sem mais context switching.

---

## O game changer: Localhost connection

A sacada crítica foi conectar o Claude Code direto no nosso **servidor local** rodando na `localhost:3000`. Isso criou um feedback loop em tempo real:

```bash
cd vibegui-internal/server  
npm run dev  # Servidor com hot reload na porta 3000
```

```
/mcp  # No Claude Code - conexão instantânea
```

**Por que isso muda tudo:**
- **Deploy instantâneo**: Mudança no código → hot reload → ferramentas novas disponíveis
- **Debug em tempo real**: Claude modifica workflows e testa na hora  
- **Iteração autônoma**: AI escreve código, testa, acha erro, corrige, verifica sucesso
- **Zero context switching**: Tudo acontece dentro da interface do Claude Code

---

## O teste completo: Mostrando como funciona

Para provar que funcionava, fizemos o ciclo completo:

### 1. Escrevi um workflow de teste com erro proposital
```typescript
// No workflows.ts - erro intencional
if (inputData.message === "test") {
  throw new Error("Test error - this is expected! Fix by changing 'test' to 'hello'");
}
```

### 2. Hot reload detectou a mudança automaticamente
```
⎔ Reloading local server...
```

### 3. Claude reconnectou o MCP e executou
```
/mcp  # Reconectar para ver o novo workflow
```
Resultado: Instance ID `70036f47-14de-4f3e-9a79-bc3bfa603067`

### 4. Checou o status e achou o erro esperado
```json
{
  "status": "failed",
  "error": "Test error - this is expected! Fix by changing 'test' to 'hello'"
}
```

### 5. Claude corrigiu o erro sozinho
Removeu a condição que causava o erro no código

### 6. Hot reload pegou a correção
```
⎔ Reloading local server...
```

### 7. Reconectou e testou de novo
Novo instance ID: `ae944270-fd19-43a8-be9b-c339d17030d6`

### 8. Sucesso!
```json
{
  "status": "success", 
  "result": "Successfully processed at 2025-08-17T16:17:32.455Z"
}
```

**O ciclo inteiro levou minutos, não horas.**

---

## Por que isso é legal

### 1. **Desenvolvimento "minerando" workflows**
O Claude vai testando, achando problemas, corrigindo, testando de novo. É como se ele estivesse "minerando" a solução perfeita através de tentativa e erro, mas de forma superinteligente.

### 2. **Feedback loop insanamente rápido**
Mudança → hot reload → teste → resultado em segundos. Isso acelera muito o desenvolvimento.

### 3. **Nossa UI dá sensação de controle**
Você vê os workflows executando, pode acompanhar o status, debugar problemas. Não é uma caixa preta.

---

## Arquitetura técnica: Como funciona na prática

### O servidor MCP
```typescript
// vibegui-internal/server/workflows.ts
export const createTestWorkflow = (env: Env) => {
  return createWorkflow({
    id: "TEST_WORKFLOW",
    inputSchema: z.object({ message: z.string() }),
    // ... workflow logic
  })
    .map(({ inputData }) => {
      console.log("Starting test workflow:", inputData.message);
      // Lógica do workflow com observabilidade completa
    })
    .commit();
};
```

### A conexão MCP
```json
// Configuração Claude Code MCP
{
  "mcpServers": {
    "vibegui-blog": {
      "command": "curl",
      "args": ["http://localhost:3000/mcp"]
    }
  }
}
```

### Hot reload automático
```bash
PORT=3000 deco dev --clean-build-dir ./view-build
⎔ Reloading local server...  # Automático quando arquivos mudam
```

---

## O que ainda falta para ficar perfeito

### 1. **Reconexão automática do MCP**
Hoje você precisa rodar `/mcp` manualmente depois de mudanças no Claude code.


### 2. **Templates de workflow**

Hoje eu tive que penar pra descobrir como expor a tool de workflow status, que é essencial pra esse feedback loop. em dev mode o mcp devia dar acesso a isso

## O que ainda falta: Só a reconexão automática

O ciclo já está quase perfeito. **O único ponto manual que sobrou** é que depois que o servidor faz hot reload, eu tenho que rodar `/mcp` para reconectar.

Fora isso, é um ciclo completamente autônomo:
1. ✅ Escrevo/modifico workflow
2. ✅ Hot reload detecta automaticamente  
3. ❌ **Preciso rodar `/mcp` manualmente** 
4. ✅ Claude testa, acha erro, corrige, testa de novo
5. ✅ Tudo rodando local com controle total

Quando a gente automatizar esse passo 3, vai ser o workflow perfeito.

## Conclusão

Foi um domingo bem produtivo. Saí da frustração de não conseguir conectar o MCP no Claude Code para um sistema onde posso **vibecodar workflows de forma autônoma**.

Agora consigo processar todos os meus posts do blog, gerar titles/excerpts automáticos, salvar no banco, debugar problemas, tudo sem sair da interface do Claude Code.

E o mais legal: tudo roda local, então tenho controle total, mas com o poder de processamento da nuvem.

---

**Guilherme**