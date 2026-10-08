# Validação separada da heurística

Comparação pareada da versão anterior (423e6d4) com o código atual. Foram usados dois territórios GeoSaúde (US Restinga e CF Santa Marta), as sementes 20261101, 20261102, 20261103 e seis combinações de fatores: 36 instâncias fora das sementes do relatório fatorial. Os pacientes são sintéticos e as escalas de área diferentes de 1× não representam limites oficiais. Ambos os métodos recebem o mesmo cenário e a mesma matriz Haversine. Valores positivos favorecem a versão atual.

| Indicador | Ganho médio | Vitórias/empates/derrotas |
|---|---:|---:|
| Cobertura planejada | 0,346 p.p. | 5/31/0 |
| Cobertura ponderada pela prioridade | 1,062 p.p. | 6/30/0 |
| Resposta pronta ponderada | 0,724 p.p. | 5/31/0 |
| Atraso controlável ponderado | 0,014 dias | 7/27/2 |
| Distância planejada | -0,392 km | 4/27/5 |
| Pontos clínicos por quilômetro | 0,023 pontos/km | 7/28/1 |

Os dados por instância estão em [validacao-versoes.csv](validacao-versoes.csv). Esta é uma validação de planos iniciais; ela não mede faltas em campo nem rotas por ruas. O total de deslocamento pode crescer quando a versão atual encaixa mais visitas.

Para repetir: compile o núcleo e os experimentos e execute `npm run factorial:validate --prefix experimentos`. O comando extrai o núcleo do commit de referência para um diretório temporário e compara os mesmos cenários com a versão atual.
