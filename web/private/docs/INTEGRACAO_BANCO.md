# AutoFlow — guia rápido de integração

O projeto foi preparado para separar **interface** de **banco/API**.

- `assets/js/script.js`: interface, validações, modais e renderização.
- `assets/js/integration.js`: único arquivo que deve receber a conexão com Supabase/backend.

## Como integrar

Implemente as funções dentro de `window.AutoFlowIntegration` em `assets/js/integration.js`.

Funções disponíveis:

- `login({ email, senha })`
- `register({ nome, telefone, email, senha })`
- `loadVehicles()`
- `createVehicle({ marca, modelo, placa, ano })`
- `loadDashboard()`
- `loadWorkshops()`
- `loadFormOptions()`
- `createMaintenance({ vehicleId, workshopId, descricao })`
- `loadEvaluations()`
- `createEvaluation({ workshopId, nota, comentario })`
- `loadProfile()`
- `updateProfile({ nome, email, telefone })`

## Formato esperado dos dados

### Veículo

```js
{
    id: 1,
    marca: "Honda",
    modelo: "Civic",
    placa: "ABC1D23",
    ano: 2020
}
```

### Oficina

```js
{
    id: 1,
    nome: "Oficina Alpha",
    endereco: "Rua Exemplo, 123",
    distancia: "2,3 km de distância",
    avaliacao: 4.8
}
```

### Dashboard

```js
{
    dashboard: {
        totalVehicles: 2,
        totalServices: 1,
        totalFinished: 3
    },
    maintenance: {
        vehicleName: "Honda Civic",
        status: "Diagnóstico"
    }
}
```

Status reconhecidos pela interface:

1. `Recebido`
2. `Diagnóstico`
3. `Aguardando Peça`
4. `Em Reparo`
5. `Pronto para Retirada`

### Avaliação

```js
{
    id: 1,
    oficina: "Oficina Alpha",
    nota: 5,
    comentario: "Ótimo atendimento."
}
```

### Perfil

```js
{
    nome: "Nome do usuário",
    email: "email@exemplo.com",
    telefone: "(11) 99999-9999"
}
```

## Respostas das operações de gravação

As funções de criação/edição podem retornar:

```js
{
    success: true,
    message: "Operação concluída!"
}
```

Em caso de erro controlado:

```js
{
    success: false,
    message: "Mensagem para o usuário"
}
```

`createVehicle` também pode devolver `vehicle`, `createEvaluation` pode devolver `evaluation`, e `updateProfile` pode devolver `profile` com os dados salvos pelo banco.

## Autenticação

O `login()` pode retornar:

```js
{
    success: true,
    redirect: "dashboard.html"
}
```

Não coloque chaves secretas administrativas do Supabase dentro de arquivos JavaScript enviados ao navegador.
