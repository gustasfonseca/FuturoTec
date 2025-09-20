Com base no seu código de backend, que agora tem permissões de acesso bem definidas, aqui está a lista **exata e completa** de todas as páginas que o seu front-end precisa para funcionar corretamente.

As páginas são agrupadas por tipo de usuário, o que irá orientar a navegação e a exibição dos componentes na sua aplicação.

---

### **Páginas de Acesso (Para Todos)**

Essas páginas são o ponto de entrada para qualquer pessoa, independentemente de sua função.

* **Página de Cadastro:** Formulário para criar a conta de usuário (e-mail e senha) e coletar os dados básicos do perfil (nome, tipo de perfil: `aluno`, `empresa` ou `assistente_tecnico`).
* **Página de Login:** Formulário para usuários existentes acessarem a plataforma com e-mail e senha.

---

### **Páginas para Alunos**

Essas páginas são visíveis e funcionais apenas para usuários com a `role` de `aluno`.

* **Página Inicial (Aluno):** Painel de controle que exibe as vagas mais recentes, cursos em destaque e pode mostrar informações do próprio aluno.
* **Página de Vagas:** Lista completa de todas as vagas disponíveis. Ao clicar em uma vaga, o aluno pode ver os detalhes e um botão para **candidatar-se**.
* **Página "Meu Perfil" (Aluno):** O aluno pode visualizar e editar seus dados pessoais, além de ver as candidaturas que ele enviou.
* **Página de Cursos:** Catálogo de todos os cursos que a plataforma oferece.

---

### **Páginas para Empresas**

Essas páginas são exclusivas para usuários com a `role` de `empresa`. A navegação deve ser diferente, com opções como "Minhas Vagas" ou "Criar Vaga".

* **Página Inicial (Empresa):** Painel de controle que mostra um resumo das vagas publicadas e o número de candidaturas recebidas.
* **Página de Gestão de Vagas:** Uma lista das vagas que a própria empresa criou. A partir daqui, a empresa pode **editar**, **excluir** ou ver as **candidaturas** de cada vaga.
* **Página de Criação de Vaga:** Formulário para preencher os detalhes e publicar uma nova vaga de emprego.
* **Página de Candidaturas:** Uma lista que exibe os alunos que se candidataram a uma vaga específica da empresa, permitindo a ela visualizar os dados dos candidatos.

---

### **Páginas para Assistentes Técnicos**

Essas páginas são apenas para usuários com a `role` de `assistente_tecnico`.

* **Página Inicial (Assistente Técnico):** Painel de controle com uma visão geral de todas as Etecs, vagas e cursos na plataforma.
* **Página de Gestão de Etecs:** Uma lista de todas as Etecs cadastradas, com opções para **criar** ou **gerenciar** Etecs.
* **Página de Criação de Etec:** Formulário para adicionar uma nova unidade Etec à plataforma.

---

### **Resumo**

O seu front-end precisa de **três fluxos de navegação diferentes** após o login: um para alunos, um para empresas e outro para assistentes técnicos. A escolha de qual fluxo mostrar deve ser baseada na `role` do usuário, que é o dado que você obtém do seu backend após a autenticação.

Essa estrutura de páginas irá garantir que a interface do usuário seja segura e que as funcionalidades correspondam exatamente às permissões que você definiu no seu backend.
